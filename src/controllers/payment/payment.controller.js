

// import stripe from "../../config/stripe.js";
// import Payment from "../../models/Payment.js";

// export const createCheckout = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const email = req.user.email;

//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       mode: "subscription",

//       customer_email: email,

//       subscription_data: {
//         trial_period_days: 7, // ✅ FREE TRIAL
//       },

//       line_items: [
//         {
//           price_data: {
//             currency: "usd",
//             product_data: {
//               name: "Puntmate Monthly Plan",
//             },
//             unit_amount: 2999, // $29.99
//             recurring: {
//               interval: "month",
//             },
//           },
//           quantity: 1,
//         },
//       ],

//       success_url: `${process.env.FRONTEND_URL || process.env.SERVER_URL}/payment-success`,
//       cancel_url: `${process.env.FRONTEND_URL || process.env.SERVER_URL}/payment-cancel`,

//       metadata: { userId },
//     });

//     await Payment.create({
//       userId,
//       stripeSessionId: session.id,
//       plan: "monthly",
//       amount: 29.99,
//       status: "pending", 
//     });

//     res.json({ url: session.url });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

import stripe from "../../config/stripe.js";
import Payment from "../../models/Payment.js";

import User from "../../models/User.model.js";

export const createCheckout = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const plan = "monthly"; // Only monthly plan available
    const priceId = process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({ message: "Stripe Price ID not configured for selected plan" });
    }

    const sessionData = {
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user.email,
      allow_promotion_codes: true, // ✅ ENABLES THE PROMO CODE FIELD
      success_url: `${process.env.FRONTEND_URL || process.env.SERVER_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL || process.env.SERVER_URL}/payment-cancel`,
      metadata: { userId, plan },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
    };

    const session = await stripe.checkout.sessions.create(sessionData);

    console.log("Stripe Session Created:", session.id); // ✅ cs_test_XXXX

    await Payment.create({
      userId,
      stripeSessionId: session.id,
      plan: "monthly",
      amount: 29.99,
      status: "pending",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe Checkout Error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user's payment record
    const payment = await Payment.findOne({ userId, status: "active" });

    if (!payment) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    if (!payment.stripeSubscriptionId) {
      return res.status(400).json({ message: "Stripe subscription ID not found" });
    }

    console.log("🔄 Cancelling Stripe subscription:", payment.stripeSubscriptionId);

    // Cancel subscription on Stripe
    await stripe.subscriptions.del(payment.stripeSubscriptionId);

    // Update payment status
    await Payment.findByIdAndUpdate(payment._id, {
      status: "cancelled",
    });

    // Update user subscription
    await User.findByIdAndUpdate(userId, {
      isSubscriptionActive: false,
      isSubscribed: false,
    });

    console.log("✅ Subscription cancelled for user:", userId);
    res.json({ 
      message: "Subscription cancelled successfully",
      userId,
      stripeSubscriptionId: payment.stripeSubscriptionId
    });
  } catch (err) {
    console.error("❌ Cancel subscription error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const payments = await Payment.find({ userId }).sort({ createdAt: -1 });
    
    res.json({
      total: payments.length,
      payments: payments.map(p => ({
        _id: p._id,
        stripeSessionId: p.stripeSessionId,
        stripeSubscriptionId: p.stripeSubscriptionId,
        plan: p.plan,
        amount: p.amount,
        status: p.status,
        currentPeriodEnd: p.currentPeriodEnd,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    });
  } catch (err) {
    console.error("❌ Get payment history error:", err.message);
    res.status(500).json({ message: err.message });
  }
};
