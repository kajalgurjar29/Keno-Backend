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
    // 🧪 MOCK MODE FOR POSTMAN TESTING
    if (sig === "mock") {
      console.log("⚠️ DEBUG: Using MOCK event (Signature verification skipped)");
      // If req.body is a buffer (because of express.raw), parse it
      event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    } else {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    }
    console.log("✅ Stripe Event Verified:", event.type);
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  /* ===============================
     CHECKOUT COMPLETED (SUBSCRIPTION)
     =============================== */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.mode === "subscription") {
      let subscription;
      if (sig === "mock") {
        // 🧪 Mock subscription data for testing
        subscription = {
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // +30 days
        };
      } else {
        subscription = await stripe.subscriptions.retrieve(session.subscription);
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

      // ✅ UPDATE USER STATUS (CORE CONCEPT)
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan || "monthly";
      if (userId) {
        console.log(`🔄 Updating User ${userId} Subscription Status...`);

        try {
          const updatedUser = await User.findByIdAndUpdate(userId, {
            isSubscriptionActive: true,
            planType: plan,
            subscriptionStart: new Date(),
            subscriptionEnd: new Date(subscription.current_period_end * 1000),
            stripeSubscriptionId: session.subscription,
            stripeCustomerId: session.customer
          }, { new: true });

          if (updatedUser) {
            console.log("✅ USER UNLOCKED SUCCESSFULLY:", {
              userId: updatedUser._id,
              isSubscriptionActive: updatedUser.isSubscriptionActive,
              planType: updatedUser.planType,
              subscriptionEnd: updatedUser.subscriptionEnd
            });
          } else {
            console.error("❌ User not found during webhook update:", userId);
          }
        } catch (updateError) {
          console.error("❌ Error updating user in webhook:", updateError);
        }
      }
    }
  }

  /* ===============================
     INVOICE PAID (RENEWAL / TRIAL END)
     =============================== */
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    console.log("🔥 STRIPE WEBHOOK HIT:", event.type);

    if (invoice.subscription) {
      let subscription;
      if (sig === "mock") {
        subscription = {
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        };
      } else {
        subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      }

      const payment = await Payment.findOneAndUpdate(
        { stripeSubscriptionId: invoice.subscription },
        {
          status: "active",
          currentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ),
        },
        { new: true }
      );

      // ✅ UPDATE USER STATUS (CORE CONCEPT)
      if (payment?.userId) {
        await User.findByIdAndUpdate(payment.userId, {
          isSubscriptionActive: true,
          subscriptionEnd: new Date(subscription.current_period_end * 1000),
        });
        console.log("✅ SUBSCRIPTION RENEWED FOR USER:", payment.userId);
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
