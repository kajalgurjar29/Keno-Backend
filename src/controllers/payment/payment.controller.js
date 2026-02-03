

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

//       success_url: `${process.env.FRONTEND_URL}/payment-success`,
//       cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,

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
    const { plan } = req.body; // "monthly" or "yearly"
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!plan) {
      return res.status(400).json({ message: "Plan (monthly or yearly) is required" });
    }

    let priceId;
    if (plan === "yearly") {
      priceId = process.env.STRIPE_YEARLY_PRICE_ID;
    } else {
      priceId = process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_PRICE_ID;
    }

    if (!priceId) {
      return res.status(500).json({ message: "Stripe Price ID not configured for selected plan" });
    }

    const sessionData = {
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user.email,
      success_url: `https://puntmate.betamxpertz.co.in/payment-success`,
      cancel_url: `https://puntmate.betamxpertz.co.in/payment-cancel`,
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
      plan: plan,
      amount: plan === "yearly" ? 299.99 : 29.99, // Adjust standard amounts as fallback
      status: "pending",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe Checkout Error:", err);
    res.status(500).json({ message: err.message });
  }
};
