import mongoose from "mongoose";
const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    stripeCustomerId: String,
    stripeSubscriptionId: String,
    stripeSessionId: String,

    plan: {
      type: String,
      default: "monthly",
    },

    amount: {
      type: Number,
      default: 29.99,
    },

    status: {
      type: String,
      enum: ["pending", "trialing", "active", "cancelled"],
      default: "pending",
    },

    currentPeriodEnd: Date,
  },
  { timestamps: true }
);
export default mongoose.model("Payment", paymentSchema);
