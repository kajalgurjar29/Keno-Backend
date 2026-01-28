// import stripe from "../../config/stripe.js";
// import Payment from "../../models/Payment.js";

// export const createCheckout = async (req, res) => {
//   try {
//     const { plan } = req.body;
//     const userId = req.user.id;

//     const amount = plan === "basic" ? 50 : 100;

//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       mode: "payment",
//       line_items: [
//         {
//           price_data: {
//             currency: "usd",
//             product_data: {
//               name: `Puntmate ${plan.toUpperCase()} Plan`,
//             },
//             unit_amount: amount * 100,
//           },
//           quantity: 1,
//         },
//       ],
//       success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
//       metadata: {
//         userId,
//         plan
//       }
//     });

//     await Payment.create({
//       userId,
//       stripeSessionId: session.id,
//       plan,
//       amount,
//       status: "pending"
//     });

//     res.json({ url: session.url });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };



// export const verifyPayment = async (req, res) => {
//   try {
//     const { session_id } = req.body;

//     const session = await stripe.checkout.sessions.retrieve(session_id);

//     if (session.payment_status === "paid") {
//       await Payment.findOneAndUpdate(
//         { stripeSessionId: session.id },
//         { status: "paid" }
//       );

//       return res.json({
//         success: true,
//         plan: session.metadata.plan
//       });
//     }

//     res.status(400).json({ success: false });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

import stripe from "../../config/stripe.js";
import Payment from "../../models/Payment.js";

export const createCheckout = async (req, res) => {
  try {
    const frontendUrl = req.headers.origin || process.env.FRONTEND_URL;
    const userId = req.user.id;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Puntmate Monthly Plan",
            },
            unit_amount: 2999, // $29.99
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/payment-success`,
      cancel_url: `${frontendUrl}/payment-cancel`,
      metadata: {
        userId,
      },
    });

    await Payment.create({
      userId,
      stripeSessionId: session.id,
      plan: "monthly",
      amount: 29.99,
      status: "pending",
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
