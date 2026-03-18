import stripe from "../../config/stripe.js";
import Payment from "../../models/Payment.js";
import User from "../../models/User.model.js";

// AUTO-ACTIVATE HELPER FOR LOCAL DEV
export const devAutoActivate = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: "Not available in production" });
  }

  const userId = req.user.id;
  try {
    const updatedUser = await User.findByIdAndUpdate(userId, {
      isSubscriptionActive: true,
      isSubscribed: true, // Also set legacy field for compatibility
      planType: "monthly", // Default for dev test
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
    }, { new: true });

    console.log("🛠️ DEV MODE: Auto-activated subscription for user:", userId);
    console.log("📊 Updated fields:", {
      isSubscriptionActive: updatedUser.isSubscriptionActive,
      isSubscribed: updatedUser.isSubscribed,
      planType: updatedUser.planType
    });
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Dev activate error", err);
    res.status(500).json({ error: err.message });
  }
};

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  console.log("⚓ Stripe Webhook received signal");

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ STRIPE_WEBHOOK_SECRET is missing from .env");
    return res.status(500).send("Webhook Secret missing");
  }

  try {
    // Ensure req.body is a buffer for constructEvent (Stripe requires raw body)
    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    if (sig === "mock") {
      console.log("⚠️ DEBUG: Using MOCK event (Signature verification skipped)");
      event = JSON.parse(payload.toString());
    } else {
      event = stripe.webhooks.constructEvent(
        payload,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    }
    console.log("✅ Stripe Event Verified:", event.type, "ID:", event.id);
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const session = event.data.object;
  const metadata = session.metadata || {};
  const userId = metadata.userId;

  /* ===============================
     1. CHECKOUT SESSION COMPLETED
     =============================== */
  if (event.type === "checkout.session.completed") {
    console.log(`🚀 PROCESSING checkout.session.completed for Session ID: ${session.id}`);

    // CASE A: SUBSCRIPTION MODE
    if (session.mode === "subscription") {
      console.log(`📝 Subscription mode detected. Sub ID: ${session.subscription}`);
      let subscription;
      try {
        if (sig === "mock") {
          subscription = { current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 };
        } else {
          subscription = await stripe.subscriptions.retrieve(session.subscription);
        }
      } catch (retrieveError) {
        console.error("❌ Error retrieving subscription from Stripe:", retrieveError.message);
        return res.status(500).json({ error: "Failed to retrieve subscription details" });
      }

      // Update internal Payment record
      const paymentUpdate = await Payment.findOneAndUpdate(
        { stripeSessionId: session.id },
        {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          status: "active",
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
        { new: true }
      );
      
      if (paymentUpdate) {
        console.log(`✅ Payment record updated: ${paymentUpdate._id}`);
      } else {
        console.warn(`⚠️ Payment record not found for Session ID: ${session.id}. Creating new record...`);
        if (userId) {
          await Payment.create({
            userId,
            stripeSessionId: session.id,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            status: "active",
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            amount: session.amount_total / 100 || 29.99
          });
        }
      }

      // Unlock User
      if (userId) {
        console.log(`🔄 Unlocking User ID: ${userId} (from metadata)...`);
        const userUpdate = await User.findByIdAndUpdate(userId, {
          isSubscriptionActive: true,
          isSubscribed: true,
          planType: metadata.plan || "monthly",
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(subscription.current_period_end * 1000),
          stripeSubscriptionId: session.subscription,
          stripeCustomerId: session.customer
        }, { new: true });
        
        if (userUpdate) {
          console.log(`🎉 SUCCESS: User ${userUpdate.email} is now SUBSCRIBED.`);
        } else {
          console.error(`❌ FAILED: User ID ${userId} not found in database.`);
        }
      } else {
        console.error("❌ CRITICAL: No userId found in session metadata!");
      }
    } 
    
    // CASE B: ONE-TIME PAYMENT MODE
    else if (session.mode === "payment") {
      console.log(`💰 One-time payment mode detected. Session: ${session.id}`);
      
      await Payment.findOneAndUpdate(
        { stripeSessionId: session.id },
        {
          status: "active",
          stripeCustomerId: session.customer,
        }
      );

      if (userId) {
        await User.findByIdAndUpdate(userId, {
          isSubscriptionActive: true,
          isSubscribed: true,
        });
        console.log(`✅ SUCCESS: User ID ${userId} unlocked for one-time payment.`);
      }
    }
  }

  /* ===============================
     2. INVOICE PAID (RECURRING RENEWAL)
     =============================== */
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    console.log(`🔄 Invoice payment succeeded for Sub ID: ${invoice.subscription}`);

    if (invoice.subscription) {
      let subscription;
      try {
        if (sig !== "mock") {
          subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        } else {
          subscription = { current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 };
        }
      } catch (retrieveError) {
        console.error("❌ Error retrieving subscription for invoice:", retrieveError.message);
      }

      // Try to find user via subscription ID or metadata
      const payment = await Payment.findOne({ stripeSubscriptionId: invoice.subscription });
      let targetUserId = payment?.userId || invoice.metadata?.userId;

      if (!targetUserId && invoice.subscription && sig !== "mock") {
        try {
          const fullSub = await stripe.subscriptions.retrieve(invoice.subscription);
          targetUserId = fullSub.metadata?.userId;
        } catch (err) {}
      }

      if (targetUserId) {
        console.log(`♻️ RENEWING subscription for User ID: ${targetUserId}...`);
        await User.findByIdAndUpdate(targetUserId, {
          isSubscriptionActive: true,
          isSubscribed: true,
          subscriptionEnd: subscription ? new Date(subscription.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        
        await Payment.findOneAndUpdate(
          { stripeSubscriptionId: invoice.subscription },
          { status: "active", currentPeriodEnd: subscription ? new Date(subscription.current_period_end * 1000) : undefined }
        );
        console.log(`✅ RENEWAL COMPLETE for User ID: ${targetUserId}`);
      } else {
        console.warn(`⚠️ Could not identify user for invoice ${invoice.id}`);
      }
    }
  }

  /* ===============================
     3. SUBSCRIPTION CANCELLED / DELETED
     =============================== */
  if (event.type === "customer.subscription.deleted") {
    const subId = event.data.object.id;
    console.log(`❌ Subscription DELETED/CANCELLED: ${subId}`);
    
    const payment = await Payment.findOneAndUpdate(
      { stripeSubscriptionId: subId },
      { status: "cancelled" }
    );

    if (payment?.userId) {
      await User.findByIdAndUpdate(payment.userId, { isSubscriptionActive: false });
      console.log(`🔓 User ID ${payment.userId} subscription marked as INACTIVE.`);
    }
  }

  /* ===============================
     4. PAYMENT FAILED (INVOICE OR INTENT)
     =============================== */
  if (event.type === "invoice.payment_failed" || event.type === "payment_intent.payment_failed") {
    const failId = event.type === "invoice.payment_failed" ? event.data.object.subscription : event.data.object.id;
    console.log(`📉 PAYMENT FAILED event received (${event.type}) for ID: ${failId}`);
    
    const payment = await Payment.findOneAndUpdate(
      { $or: [{ stripeSubscriptionId: failId }, { stripeSessionId: failId }] },
      { status: "cancelled" }
    );

    if (payment?.userId) {
      await User.findByIdAndUpdate(payment.userId, { isSubscriptionActive: false });
      console.log(`❌ Payment failure handled: User ID ${payment.userId} deactivated.`);
    }
  }

  res.json({ received: true });
};

