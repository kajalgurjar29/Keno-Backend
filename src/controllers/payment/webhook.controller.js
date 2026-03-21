import stripe from "../../config/stripe.js";
import Payment from "../../models/Payment.js";
import User from "../../models/User.model.js";
import { getIO } from "../../utils/socketUtils.js";

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
    // 🧪 MOCK MODE FOR POSTMAN TESTING
    if (sig === "mock") {
      console.log("⚠️ DEBUG: Using MOCK event (Signature verification skipped)");
      event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    } else {
      if (!Buffer.isBuffer(req.body)) {
        console.error("❌ CRITICAL: Webhook body is NOT a buffer! Signature verification WILL fail.");
        return res.status(400).send("Invalid webhook body format");
      }

      const payload = req.body;
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

  /* ===============================
     CHECKOUT COMPLETED (SUBSCRIPTION)
     =============================== */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("✅ CHECKOUT COMPLETED EVENT:", session.id);

    if (session.mode === "subscription") {
      try {
        let subscription;
        if (sig === "mock") {
          subscription = {
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          };
        } else {
          if (!session.subscription) {
            console.error("❌ No subscription ID in session:", session.id);
            return res.status(400).send("No subscription in session");
          }
          subscription = await stripe.subscriptions.retrieve(session.subscription);
        }

        // ✅ Step 1: Update or Create Payment Record
        const payment = await Payment.findOneAndUpdate(
          { stripeSessionId: session.id },
          {
            userId: session.metadata?.userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            status: "active",
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
          { new: true, upsert: true }
        );

        // ✅ Step 2: Identify User (Metadata -> Payment Record -> Email -> Customer ID)
        let userId = session.metadata?.userId || payment?.userId;
        let user;

        if (userId && userId !== "undefined") {
          user = await User.findById(userId);
        }

        // 🕵️ Fallback 1: Identify via Email from Stripe Session
        if (!user && session.customer_details?.email) {
          console.log("🔍 Fallback: Searching user by session.customer_details.email:", session.customer_details.email);
          user = await User.findOne({ email: session.customer_details.email.toLowerCase() });
        }

        // 🕵️ Fallback 2: find by Customer ID if userId lookup failed
        if (!user && session.customer) {
          console.log("🔍 Fallback: Searching user by stripeCustomerId:", session.customer);
          user = await User.findOne({ stripeCustomerId: session.customer });
        }

        if (user) {
          console.log(`📡 Identified User ${user.email}. Updating Subscription Status...`);

          let plan = session.metadata?.plan || payment?.plan || "monthly";

          // Ensure the plan matches our model enum (must be "trial" or "monthly")
          if (plan !== "monthly" && plan !== "trial") {
            console.log(`⚠️ Stripe plan '${plan}' is not a valid enum member. Falling back to 'monthly'.`);
            plan = "monthly";
          }

          const updatedUser = await User.findByIdAndUpdate(
            user._id,
            {
              isSubscriptionActive: true,
              isSubscribed: true,
              planType: plan,
              subscriptionStart: new Date(),
              subscriptionEnd: new Date(subscription.current_period_end * 1000),
              stripeSubscriptionId: session.subscription,
              stripeCustomerId: session.customer
            },
            { new: true }
          );

          if (updatedUser) {
            console.log("✅ USER UNLOCKED SUCCESSFULLY:", updatedUser.email);
            console.log("📊 Fields Updated:", {
              isActive: updatedUser.isSubscriptionActive,
              isSubscribed: updatedUser.isSubscribed,
              plan: updatedUser.planType
            });

            // 📢 NOTIFY FRONTEND VIA SOCKET
            try {
              const io = getIO();
              io.emit("payment-success", {
                userId: updatedUser._id,
                email: updatedUser.email,
                status: "active"
              });
              console.log("📢 Emitted 'payment-success' socket event to user:", updatedUser._id);
            } catch (socketErr) {
              console.warn("⚠️ Failed to emit socket event (expected in scripts/testing):", socketErr.message);
            }
          }
        } else {
          console.error("❌ Could not identify user for session:", session.id);
          console.error("   Metadata userId:", session.metadata?.userId);
          console.error("   Customer ID:", session.customer);
          console.error("   Customer Email:", session.customer_details?.email);
        }
      } catch (checkoutError) {
        console.error("❌ Error processing checkout.session.completed:", checkoutError.message);
      }
    }
  }

  /* ===============================
     INVOICE PAID / PAYMENT SUCCEEDED
     =============================== */
  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
    const invoice = event.data.object;
    console.log("🔥 Payment Success Event:", event.type, "Invoice:", invoice.id);

    if (invoice.subscription) {
      try {
        let subscription;
        if (sig === "mock") {
          subscription = { current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 };
        } else {
          subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        }

        // 1. Identify User (Priority Order)
        let user;

        // Try by Payment record with subscription ID
        const payment = await Payment.findOne({ stripeSubscriptionId: invoice.subscription });
        if (payment?.userId) {
          user = await User.findById(payment.userId);
        }

        // 🕵️ Fallback 1: Identify via Stripe Customer ID (on the User record)
        if (!user && invoice.customer) {
          console.log("🔍 Fallback: Searching user by stripeCustomerId:", invoice.customer);
          user = await User.findOne({ stripeCustomerId: invoice.customer });
        }

        // 🕵️ Fallback 2: Identify via Email from invoice
        if (!user && invoice.customer_email) {
          console.log("🔍 Fallback: Searching user by invoice.customer_email:", invoice.customer_email);
          user = await User.findOne({ email: invoice.customer_email.toLowerCase() });
        }

        // 🕵️ Fallback 3: From the stripe subscription object directly
        if (!user && subscription.customer) {
          const customer = await stripe.customers.retrieve(subscription.customer);
          if (customer.email) {
            console.log("🔍 Fallback: Searching user by subscription.customer.email:", customer.email);
            user = await User.findOne({ email: customer.email.toLowerCase() });
          }
        }

        if (user) {
          console.log(`📡 Invoice Paid: Updating User ${user.email}...`);

          // Update User
          await User.findByIdAndUpdate(user._id, {
            isSubscriptionActive: true,
            isSubscribed: true,
            subscriptionEnd: new Date(subscription.current_period_end * 1000),
            stripeSubscriptionId: invoice.subscription,
            stripeCustomerId: user.stripeCustomerId || invoice.customer
          });

          // Update Payment record
          await Payment.findOneAndUpdate(
            { stripeSubscriptionId: invoice.subscription },
            {
              status: "active",
              userId: user._id,
              stripeCustomerId: invoice.customer,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
            { new: true, upsert: true }
          );

          console.log("✅ SUBSCRIPTION UPDATED SUCCESSFULLY FOR USER:", user.email);

          // 📢 NOTIFY FRONTEND VIA SOCKET
          try {
            const io = getIO();
            io.emit("payment-success", {
              userId: user._id,
              email: user.email,
              status: "active"
            });
            console.log("📢 Emitted 'payment-success' socket event to user:", user._id);
          } catch (socketErr) {
            console.warn("⚠️ Failed to emit socket event (expected in scripts/testing):", socketErr.message);
          }
        } else {
          console.error("❌ Invoice Paid: Could not determine user for subscription:", invoice.subscription);
        }
      } catch (invoiceError) {
        console.error("❌ Error processing invoice success:", invoiceError.message);
      }
    }
  }

  /* ===============================
     SUBSCRIPTION CANCELLED
     =============================== */
  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object;

    // If it's a deletion or if it's an update where status is no longer active
    if (event.type === "customer.subscription.deleted" ||
      (event.type === "customer.subscription.updated" && subscription.status !== 'active' && subscription.status !== 'trialing')) {

      const payment = await Payment.findOneAndUpdate(
        { stripeSubscriptionId: subscription.id },
        { status: "cancelled" },
        { new: true }
      );

      let user;
      if (payment?.userId) user = await User.findById(payment.userId);
      if (!user && subscription.customer) user = await User.findOne({ stripeCustomerId: subscription.customer });

      if (user) {
        await User.findByIdAndUpdate(user._id, {
          isSubscriptionActive: false,
          isSubscribed: false
        });
        console.log("❌ SUBSCRIPTION CANCELLED FOR USER:", user.email);
      }
    }
  }

  /* ===============================
     PAYMENT FAILED
     =============================== */
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;

    const payment = await Payment.findOne({ stripeSubscriptionId: invoice.subscription });
    let user;
    if (payment?.userId) user = await User.findById(payment.userId);
    if (!user && invoice.customer) user = await User.findOne({ stripeCustomerId: invoice.customer });

    if (user) {
      await User.findByIdAndUpdate(user._id, {
        isSubscriptionActive: false,
      });
      console.log("❌ PAYMENT FAILED FOR USER:", user.email);
    }
  }

  res.json({ received: true });
};

