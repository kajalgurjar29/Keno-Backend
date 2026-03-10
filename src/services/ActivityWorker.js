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
                title: "Welcome to Punt data! 🏇",
                body: `Hello ${user.fullName}, thank you for joining our platform. Good luck with your punting!`,
                category: "activity",
                priority: "medium"
            });
        });

        // 2. Successful Login
        eventBus.on(EVENTS.USER_LOGGED_IN, async ({ user, ip }) => {
            if (!ip) return; // Can't verify system without IP

            // Check if this is a new IP/System
            const isNewSystem = !user.knownIPs || !user.knownIPs.includes(ip);

            if (isNewSystem) {
                console.log(`🛡️ New login detected from IP: ${ip}. Notifying user...`);

                await NotificationService.notifyUser({
                    userId: user._id,
                    title: "Login Detected",
                    body: `New login to your account detected from ${ip}. If this wasn't you, please change your password immediately.`,
                    category: "activity",
                    priority: "low",
                    metadata: { type: 'security', ip }
                });

                // Save this as a known system for next time
                try {
                    // We use updateOne instead of user.save() to be safer within the event loop
                    const UserModel = user.constructor;
                    await UserModel.updateOne(
                        { _id: user._id },
                        { $addToSet: { knownIPs: ip } }
                    );
                } catch (saveErr) {
                    console.error("Failed to save new known IP:", saveErr.message);
                }
            } else {
                console.log(`✅ Login from known system (${ip}). skipping notification.`);
            }
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
