import User from "../models/User.model.js";
import { calculateSubscriptionStatus } from "../utils/subscriptionUtils.js";

export const checkSubscription = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // DYNAMIC CALCULATION
        const { isSubscriptionActive, isSubscribed } = calculateSubscriptionStatus(user);

        // Update DB only if value has changed (e.g. just expired)
        if (user.isSubscriptionActive !== isSubscriptionActive || user.isSubscribed !== isSubscribed) {
            user.isSubscriptionActive = isSubscriptionActive;
            user.isSubscribed = isSubscribed;
            await user.save();
        }

        if (isSubscriptionActive) {
            return next();
        }

        // Access Denied
        const now = new Date();
        return res.status(403).json({
            message: "Subscription required",
            isSubscriptionActive: false,
            planType: user.planType,
            trialExpired: user.planType === "trial" && now > new Date(user.trialEnd),
            subscriptionExpired: (user.planType === "monthly" || user.planType === "yearly") && now > new Date(user.subscriptionEnd)
        });
    } catch (error) {
        console.error("Access Check Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
