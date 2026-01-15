import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    stripeCustomerId: {
      type: String,
    },

    stripeSubscriptionId: {
      type: String,
    },

    stripeSessionId: {
      type: String,
    },

    plan: {
      type: String,
      default: "monthly", // single plan
    },

    amount: {
      type: Number,
      default: 29.99,
    },

    status: {
      type: String,
      enum: ["pending", "active", "cancelled"],
      default: "pending",
    },

    currentPeriodEnd: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
