import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  stripeSessionId: String,
  plan: {
    type: String,
    enum: ["basic", "pro"]
  },
  amount: Number,
  status: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending"
  }
}, { timestamps: true });

export default mongoose.model("Payment", paymentSchema);
