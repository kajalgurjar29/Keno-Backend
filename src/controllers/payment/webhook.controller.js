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

import fs from 'fs';
import path from 'path';

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  // 📝 DEBUG LOGGING TO FILE
  const logMessage = `\n[${new Date().toISOString()}] ⚓ Webhook Signal Received - Sig: ${sig ? 'YES' : 'NO'}\n`;
  fs.appendFileSync('stripe_debug.log', logMessage);

  console.log("⚓ Stripe Webhook received signal");

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ STRIPE_WEBHOOK_SECRET is missing from .env");
    return res.status(500).send("Webhook Secret missing");
  }

  try {
    // Ensure req.body is a buffer for constructEvent (Stripe requires raw body)
  const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  
  try {
    if (sig === "mock") {
      event = JSON.parse(payload.toString());
    } else {
      event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 📝 DEBUG LOGS (FIX 4)
  console.log("🔥 Webhook received");
  console.log("EVENT TYPE:", event.type);

  let userId = null; // 🔥 FIX 2: Initialize userId globally but extract per event

  /* ===============================
     1. CHECKOUT SESSION COMPLETED (Initial Payment)
     =============================== */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    userId = session.metadata?.userId; // 🔥 FIX 2: Extract from session metadata
    console.log("🔍 FINAL userId (Session):", userId);

    // CASE A: SUBSCRIPTION MODE
    if (session.mode === "subscription") {
      let subscriptionData;
      try {
        subscriptionData = sig === "mock" ? { current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 } : await stripe.subscriptions.retrieve(session.subscription);
      } catch (err) {
        console.error("❌ Error retrieving subscription from Stripe:", err.message);
        return res.status(500).json({ error: "Failed to retrieve subscription details" });
      }

      // Update internal Payment record
      await Payment.findOneAndUpdate(
        { stripeSessionId: session.id },
        {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          status: "active",
          currentPeriodEnd: subscriptionData ? new Date(subscriptionData.current_period_end * 1000) : undefined,
        }
      );

      // Unlock User
      if (userId) {
        console.log(`🔄 Unlocking User ID: ${userId} (from metadata)...`);
        await User.findByIdAndUpdate(userId, {
          isSubscriptionActive: true,
          isSubscribed: true,
          planType: session.metadata.plan || "monthly", // Assuming plan is in session metadata
          subscriptionStart: new Date(),
          subscriptionEnd: subscriptionData ? new Date(subscriptionData.current_period_end * 1000) : undefined,
          stripeSubscriptionId: session.subscription,
          stripeCustomerId: session.customer
        });
        console.log(`🎉 SUCCESS: User ID ${userId} is now SUBSCRIBED.`);
      }
    } 
    
    // CASE B: ONE-TIME PAYMENT MODE
    else if (session.mode === "payment") {
      await Payment.findOneAndUpdate(
        { stripeSessionId: session.id },
        { status: "active", stripeCustomerId: session.customer }
      );
      if (userId) {
        await User.findByIdAndUpdate(userId, { isSubscriptionActive: true, isSubscribed: true });
        console.log(`✅ SUCCESS: One-time payment for User ID: ${userId}`);
      }
    }
  }

  /* ===============================
     2. INVOICE PAID (RECURRING RENEWAL / FIRST PAYMENT)
     =============================== */
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    console.log(`🔄 [INVOICE] paymentucceeded for Sub ID: ${invoice.subscription}`);
    
    // 🔥 FIX 2 & 3: Robust userId extraction for invoices
    userId = invoice.metadata?.userId; 

    if (!userId && invoice.subscription) {
      console.log("🔍 Metadata missing in invoice. Checking DB...");
      const payment = await Payment.findOne({ stripeSubscriptionId: invoice.subscription });
      userId = payment?.userId;
    }

    if (!userId && invoice.subscription && sig !== "mock") {
      console.log("🔍 Metadata missing in DB. Retrieving subscription from Stripe...");
      try {
        const fullSub = await stripe.subscriptions.retrieve(invoice.subscription);
        userId = fullSub.metadata?.userId;
      } catch (err) {
        console.error("❌ Error retrieving subscription for userId fallback:", err.message);
      }
    }

    console.log("🔍 FINAL userId (Invoice):", userId);

    if (userId) {
      let subscriptionData;
      try {
          subscriptionData = sig === "mock" ? { current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 } : await stripe.subscriptions.retrieve(invoice.subscription);
      } catch (err) {
        console.error("❌ Error retrieving subscription for renewal update:", err.message);
      }

      await User.findByIdAndUpdate(userId, {
        isSubscriptionActive: true,
        isSubscribed: true,
        subscriptionEnd: subscriptionData ? new Date(subscriptionData.current_period_end * 1000) : undefined
      });
      
      await Payment.findOneAndUpdate(
        { stripeSubscriptionId: invoice.subscription },
        { status: "active", currentPeriodEnd: subscriptionData ? new Date(subscriptionData.current_period_end * 1000) : undefined }
      );
      console.log(`✅ SUCCESS: DB Updated for User ID: ${userId}`);
    } else {
       // 🔥 FIX 4: Log error if still not found
       console.error("❌ No userId found. Cannot update DB for invoice.payment_succeeded event.");
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
  } catch (err) {
    console.error("💥 WEBHOOK HANDLER ERROR:", err.message);
    res.status(500).json({ error: "Internal server error during webhook processing" });
  }
};
