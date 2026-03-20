/**
 * Calculates current subscription status based on user dates
 * @param {Object} user - User document
 * @returns {Object} { isSubscriptionActive, isSubscribed }
 */
export const calculateSubscriptionStatus = (user) => {
    const now = new Date();
    let isSubscriptionActive = false;
    let isSubscribed = false;

    // Safety check: if user is missing planType, they are NOT active
    if (!user.planType) {
        return { isSubscriptionActive: false, isSubscribed: false };
    }

    if (user.planType === "trial") {
        // 1. Trial Flow
        // We consider it active if trialEnd exists and is in the future
        if (user.trialEnd && now <= new Date(user.trialEnd)) {
            isSubscriptionActive = true;
            isSubscribed = false; 
        } 
        // Also check if subscriptionEnd was set (fallback)
        else if (user.subscriptionEnd && now <= new Date(user.subscriptionEnd)) {
            isSubscriptionActive = true;
            isSubscribed = true;
        }
    } else if (user.planType === "monthly") {
        // 2. Paid Plan Flow
        if (user.subscriptionEnd && now <= new Date(user.subscriptionEnd)) {
            isSubscriptionActive = true;
            isSubscribed = true;
        }
    }

    return { isSubscriptionActive, isSubscribed };
};
