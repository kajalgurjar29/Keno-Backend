import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    stripeSubscriptionId: String,
    status: String,
    currentPeriodEnd: Date,
}, { timestamps: true });

export default mongoose.model("Subscription", subscriptionSchema);
