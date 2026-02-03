import User from "../models/User.model.js";

export const checkSubscription = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const now = new Date();

        // 1. Trial valid check
        if (
            user.planType === "trial" &&
            user.trialEnd &&
            now <= new Date(user.trialEnd)
        ) {
            return next();
        }

        // 2. Paid subscription valid check
        if (
            user.isSubscriptionActive &&
            user.subscriptionEnd &&
            now <= new Date(user.subscriptionEnd)
        ) {
            return next();
        }

        // Default: Access Denied
        return res.status(403).json({
            message: "Subscription required",
            isSubscriptionActive: false,
            planType: user.planType,
            trialExpired: user.planType === "trial" && now > new Date(user.trialEnd)
        });
    } catch (error) {
        console.error("Access Check Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
