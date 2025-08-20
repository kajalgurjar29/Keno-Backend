import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiry: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL Index → auto delete expired OTPs
otpSchema.index({ expiry: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("OtpToken", otpSchema);
