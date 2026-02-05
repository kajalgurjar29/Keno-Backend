/**
 * Calculates current subscription status based on user dates
 * @param {Object} user - User document
 * @returns {Object} { isSubscriptionActive, isSubscribed }
 */
export const calculateSubscriptionStatus = (user) => {
    const now = new Date();
    let isSubscriptionActive = false;
    let isSubscribed = false;

    if (user.planType === "trial") {
        // 1. Trial Flow
        if (user.trialEnd && now <= new Date(user.trialEnd)) {
            isSubscriptionActive = true;
            isSubscribed = false; // trial is not a "subscriber" in payment terms
        } else {
            isSubscriptionActive = false;
            isSubscribed = false;
        }
    } else if (user.planType === "monthly" || user.planType === "yearly") {
        // 2. Paid Plan Flow
        if (user.subscriptionEnd && now <= new Date(user.subscriptionEnd)) {
            isSubscriptionActive = true;
            isSubscribed = true;
        } else {
            isSubscriptionActive = false;
            isSubscribed = false;
        }
    }

    return { isSubscriptionActive, isSubscribed };
};
