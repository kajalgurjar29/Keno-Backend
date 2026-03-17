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
    console.log("📦 Webhook Body Type:", typeof req.body, "IsBuffer:", Buffer.isBuffer(req.body));

    // 🧪 MOCK MODE FOR POSTMAN TESTING
    if (sig === "mock") {
      console.log("⚠️ DEBUG: Using MOCK event (Signature verification skipped)");
      // If req.body is a buffer (because of express.raw), parse it
      event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    } else {
      // Ensure req.body is a buffer for constructEvent
      const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

      event = stripe.webhooks.constructEvent(
        payload,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    }
    console.log("✅ Stripe Event Verified:", event.type, "ID:", event.id);
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    console.error("Signature received:", sig ? "YES" : "NO");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  /* ===============================
     CHECKOUT COMPLETED (SUBSCRIPTION)
     =============================== */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.mode === "subscription") {
      let subscription;
      try {
        if (sig === "mock") {
          // 🧪 Mock subscription data for testing
          subscription = {
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // +30 days
          };
        } else {
          subscription = await stripe.subscriptions.retrieve(session.subscription);
        }
      } catch (retrieveError) {
        console.error("❌ Error retrieving subscription from Stripe:", retrieveError.message);
        return res.status(500).json({ error: "Failed to retrieve subscription details" });
      }

      // ✅ Update Payment
      const payment = await Payment.findOneAndUpdate(
        { stripeSessionId: session.id },
        {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          status: "active",
          currentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ),
        },
        { new: true }
      );

      if (payment) {
        console.log("✅ Payment record updated for session:", session.id);
      } else {
        console.warn("⚠️ No internal Payment record found for session:", session.id);
      }

      // ✅ UPDATE USER STATUS (CORE CONCEPT)
      const userId = session.metadata?.userId;

      if (userId) {
        console.log(`🔄 Updating User ${userId} Subscription Status to monthly...`);

        try {
          const updatedUser = await User.findByIdAndUpdate(userId, {
            isSubscriptionActive: true,
            isSubscribed: true,
            planType: "monthly",
            subscriptionStart: new Date(),
            subscriptionEnd: new Date(subscription.current_period_end * 1000),
            stripeSubscriptionId: session.subscription,
            stripeCustomerId: session.customer
          }, { new: true });

          if (updatedUser) {
            console.log("✅ USER UNLOCKED SUCCESSFULLY:", updatedUser.email);
          } else {
            console.error("❌ User not found with ID:", userId);
          }
        } catch (updateError) {
          console.error("❌ Error updating user in webhook:", updateError);
        }
      } else {
        console.error("❌ No userId found in session metadata. Metadata found:", session.metadata);
      }
    }
  }

  /* ===============================
     INVOICE PAID (RENEWAL / TRIAL END)
     =============================== */
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    console.log("🔥 STRIPE WEBHOOK HIT: invoice.payment_succeeded");

    if (invoice.subscription) {
      let subscription;
      try {
        if (sig === "mock") {
          subscription = {
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          };
        } else {
          subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        }
      } catch (retrieveError) {
        console.error("❌ Error retrieving subscription for invoice:", retrieveError.message);
        // Continue anyway as we have basic invoice info
      }

      // Attempt to find payment record
      // NOTE: For the first payment, checkout.session.completed might not have run yet,
      // so we might not find it by stripeSubscriptionId if it hasn't been set.
      const payment = await Payment.findOneAndUpdate(
        { stripeSubscriptionId: invoice.subscription },
        {
          status: "active",
          currentPeriodEnd: subscription ? new Date(subscription.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        { new: true }
      );

      // 1. Try to find userId in database via subscription ID
      let targetUserId = payment?.userId;
      console.log(`🔍 [Invoice] Searching for user by subscription ID: ${invoice.subscription}. Found in DB: ${!!targetUserId}`);

      // 2. Fallback: Check invoice metadata (Stripe copies this from subscription)
      if (!targetUserId && invoice.metadata?.userId) {
        targetUserId = invoice.metadata.userId;
        console.log(`🔍 [Invoice] Found userId in invoice.metadata: ${targetUserId}`);
      }

      // 3. Last Resort Fallback: Fetch the subscription object from Stripe
      // Often the first invoice doesn't have metadata yet, but the subscription DOES.
      if (!targetUserId && invoice.subscription && sig !== "mock") {
        try {
          console.log(`🔍 [Invoice] Metadata missing. Fetching subscription ${invoice.subscription} from Stripe...`);
          const fullSub = await stripe.subscriptions.retrieve(invoice.subscription);
          targetUserId = fullSub.metadata?.userId;
          if (targetUserId) console.log(`✅ [Invoice] Recovered userId from Stripe Subscription object: ${targetUserId}`);
        } catch (subErr) {
          console.error("❌ [Invoice] Failed to fetch subscription for metadata recovery", subErr.message);
        }
      }

      if (targetUserId) {
        console.log(`🔄 [Invoice] Activating User ${targetUserId}...`);
        const updateData = {
          isSubscriptionActive: true,
          isSubscribed: true,
          planType: "monthly", // ✅ Force to monthly since we removed yearly
          subscriptionEnd: subscription ? new Date(subscription.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          stripeSubscriptionId: invoice.subscription,
          stripeCustomerId: invoice.customer
        };

        const updateResult = await User.findByIdAndUpdate(targetUserId, updateData, { new: true });
        if (updateResult) {
          console.log("✅ [Invoice] DB UPDATED SUCCESSFULLY for", updateResult.email);
        } else {
          console.error("❌ [Invoice] User not found during update:", targetUserId);
        }
      } else {
        console.warn("⚠️ [Invoice] COMPLETELY FAILED to find a userId for this payment. Invoice Metadata:", invoice.metadata);
      }
    }
  }

  /* ===============================
     SUBSCRIPTION CANCELLED
     =============================== */
  if (event.type === "customer.subscription.deleted") {
    const payment = await Payment.findOneAndUpdate(
      { stripeSubscriptionId: event.data.object.id },
      { status: "cancelled" },
      { new: true }
    );

    // ✅ UPDATE USER STATUS (CORE CONCEPT)
    if (payment?.userId) {
      await User.findByIdAndUpdate(payment.userId, {
        isSubscriptionActive: false,
      });
      console.log("❌ SUBSCRIPTION CANCELLED FOR USER:", payment.userId);
    }
  }

  /* ===============================
     PAYMENT FAILED
     =============================== */
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const payment = await Payment.findOne({ stripeSubscriptionId: invoice.subscription });

    if (payment?.userId) {
      await User.findByIdAndUpdate(payment.userId, {
        isSubscriptionActive: false,
      });
      console.log("❌ PAYMENT FAILED FOR USER:", payment.userId);
    }
  }

  res.json({ received: true });
};
