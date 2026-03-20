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
    console.log("📦 Webhook Body Type:", typeof req.body);
    console.log("📦 Is Buffer:", Buffer.isBuffer(req.body));
    console.log("📦 Secret present:", !!process.env.STRIPE_WEBHOOK_SECRET);
    console.log("🔗 Signature present:", !!sig);

    // 🧪 MOCK MODE FOR POSTMAN TESTING
    if (sig === "mock") {
      console.log("⚠️ DEBUG: Using MOCK event (Signature verification skipped)");
      // If req.body is a buffer (because of express.raw), parse it
      event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    } else {
      // Ensure req.body is a buffer for constructEvent
      if (!Buffer.isBuffer(req.body)) {
        console.error("❌ CRITICAL: Webhook body is NOT a buffer! Signature verification WILL fail.");
        console.error("Check app.js middleware order and express.raw usage.");
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
    console.error("Signature received:", sig ? "YES" : "NO");
    console.error("Hint: This is often caused by an incorrect STRIPE_WEBHOOK_SECRET or modified req.body.");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  /* ===============================
     CHECKOUT COMPLETED (SUBSCRIPTION)
     =============================== */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("✅ CHECKOUT COMPLETED EVENT:", session.id);
    console.log("📋 Session Details:", {
      mode: session.mode,
      customer: session.customer,
      subscription: session.subscription,
      metadata: session.metadata
    });

    if (session.mode === "subscription") {
      try {
        let subscription;
        if (sig === "mock") {
          // 🧪 Mock subscription data for testing
          subscription = {
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // +30 days
          };
        } else {
          if (!session.subscription) {
            console.error("❌ No subscription ID in session:", session.id);
            return res.status(400).send("No subscription in session");
          }
          subscription = await stripe.subscriptions.retrieve(session.subscription);
        }

        console.log("📊 Subscription retrieved:", subscription.id);

        // 🔍 DEBUG: Check if Payment record exists BEFORE update
        console.log("🔍 Searching for Payment with stripeSessionId:", session.id);
        const existingPayment = await Payment.findOne({ stripeSessionId: session.id });
        if (existingPayment) {
          console.log("✅ Found existing Payment record:", existingPayment._id, "userId:", existingPayment.userId);
        } else {
          console.warn("⚠️ NO Payment record found for this session! Creating one...");
        }

        // ✅ Update Payment
        const payment = await Payment.findOneAndUpdate(
          { stripeSessionId: session.id },
          {
            userId: session.metadata?.userId, // ✅ Ensure userId is always attached
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            status: "active",
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
          { new: true, upsert: true } // 🆕 upsert: creates if not found
        );

        if (payment) {
          console.log("✅ Payment updated to status: active", payment._id);
          console.log("💾 Payment Record NOW:", {
            _id: payment._id,
            userId: payment.userId,
            stripeSessionId: payment.stripeSessionId,
            stripeSubscriptionId: payment.stripeSubscriptionId,
            status: payment.status,
            currentPeriodEnd: payment.currentPeriodEnd
          });
        } else {
          console.error("❌ Payment record still null after update!");
        }

        // ✅ UPDATE USER STATUS (CORE CONCEPT)
        let userId = session.metadata?.userId || payment?.userId;
        const plan = session.metadata?.plan || payment?.plan || "monthly";
        
        console.log("📌 User Info from session:", {
          userId: userId,
          plan: plan,
          metadataUserId: session.metadata?.userId,
          paymentUserId: payment?.userId
        });

        console.log("🔍 DEBUG: userId value:", userId, "| Type:", typeof userId, "| Payment userId:", payment?.userId);

        if (userId) {
          console.log(`🔄 Updating User ${userId} Subscription Status...`);
          console.log("   userId type:", typeof userId);
          console.log("   userId stringified:", JSON.stringify(userId));

          // 🔍 DEBUG: Check if User exists
          try {
            const userExists = await User.findById(userId);
            console.log("🔍 User.findById query result:", userExists ? "FOUND" : "NOT FOUND");
            
            if (!userExists) {
              console.error("❌ User NOT FOUND in database with ID:", userId);
              console.error("   Type of userId:", typeof userId);
              console.error("   Hint: Check if userId is correct and user was created");
              
              // Try alternative queries for debugging
              const userByEmail = await User.findOne({ email: userExists?.email });
              console.log("🔍 Alternative query (by email):", userByEmail ? "FOUND" : "NOT FOUND");
            } else {
              console.log("✅ User exists:", userExists.email, "| ID:", userExists._id);
            }
          } catch (findError) {
            console.error("❌ Error finding user:", findError.message);
          }

          try {
            console.log("📝 About to update User with data:", {
              isSubscriptionActive: true,
              isSubscribed: true,
              planType: plan,
              stripeSubscriptionId: session.subscription,
              stripeCustomerId: session.customer
            });

            const updatedUser = await User.findByIdAndUpdate(
              userId, 
              {
                isSubscriptionActive: true,
                isSubscribed: true,
                planType: plan,
                subscriptionStart: new Date(),
                subscriptionEnd: new Date(subscription.current_period_end * 1000),
                stripeSubscriptionId: session.subscription,
                stripeCustomerId: session.customer
              }, 
              { new: true, runValidators: false }
            );

            console.log("📊 Update result:", updatedUser ? "SUCCESS" : "RETURNED NULL");

            if (updatedUser) {
              console.log("✅ USER UNLOCKED SUCCESSFULLY:", updatedUser.email);
              console.log("🎉 User subscription fields AFTER update:", {
                _id: updatedUser._id,
                email: updatedUser.email,
                isSubscriptionActive: updatedUser.isSubscriptionActive,
                isSubscribed: updatedUser.isSubscribed,
                planType: updatedUser.planType,
                subscriptionEnd: updatedUser.subscriptionEnd,
                stripeSubscriptionId: updatedUser.stripeSubscriptionId
              });
            } else {
              console.error("❌ User not found or update returned null for ID:", userId);
            }
          } catch (updateError) {
            console.error("❌ Error updating user in webhook:", updateError.message);
            console.error("   Error stack:", updateError.stack);
          }
        } else {
          console.error("❌ No userId found in metadata or payment record");
          console.error("   session.metadata:", session.metadata);
          console.error("   payment:", payment);
        }
      } catch (checkoutError) {
        console.error("❌ Error processing checkout.session.completed:", checkoutError.message);
        console.error("Stack:", checkoutError.stack);
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
          isSubscribed: true,
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
