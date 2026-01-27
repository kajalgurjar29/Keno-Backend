import eventBus, { EVENTS } from "../utils/eventBus.js";
import NotificationService from "./NotificationService.js";

/**
 * Activity Worker
 * Listens for user-triggered events and sends appropriate notifications
 */
class ActivityWorker {
    static init() {
        // 1. User Registration
        eventBus.on(EVENTS.USER_REGISTERED, async ({ user }) => {
            await NotificationService.notifyUser({
                userId: user._id,
                title: "Welcome to Punt Mate! 🏇",
                body: `Hello ${user.fullName}, thank you for joining our platform. Good luck with your punting!`,
                category: "activity",
                priority: "medium"
            });
        });

        // 2. Successful Login
        eventBus.on(EVENTS.USER_LOGGED_IN, async ({ user, ip }) => {
            await NotificationService.notifyUser({
                userId: user._id,
                title: "Login Detected",
                body: `New login to your account detected from ${ip || 'unknown IP'}.`,
                category: "activity",
                priority: "low",
                metadata: { type: 'security' }
            });
        });

        // 3. Password Change
        eventBus.on(EVENTS.PASSWORD_CHANGED, async ({ userId }) => {
            await NotificationService.notifyUser({
                userId: userId,
                title: "Password Changed 🔒",
                body: "Your account password has been successfully updated.",
                category: "activity",
                priority: "high"
            });
        });

        // 4. Subscription Purchase
        eventBus.on(EVENTS.SUBSCRIPTION_PURCHASED, async ({ userId, planName }) => {
            await NotificationService.notifyUser({
                userId: userId,
                title: "Subscription Activated! ✨",
                body: `Your ${planName} subscription is now active. Enjoy premium features!`,
                category: "activity",
                priority: "high"
            });
        });
        // 5. Profile Update
        eventBus.on(EVENTS.PROFILE_UPDATED, async ({ userId }) => {
            await NotificationService.notifyUser({
                userId: userId,
                title: "Profile Updated ✅",
                body: "Your profile details have been successfully updated.",
                category: "activity",
                priority: "medium"
            });
        });
    }
}

export default ActivityWorker;
