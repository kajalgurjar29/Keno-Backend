import admin from "../config/firebaseAdmin.js";
import Notification from "../models/Notification.js";
import User from "../models/User.model.js";
import sendEmail from "../utils/sendEmail.js";
import { getIO } from "../utils/socketUtils.js";

/**
 * Robust Notification Service
 * Handles delivery via In-App, Push, and Email based on User Preferences
 */
class NotificationService {
    /**
     * Send a notification to a specific user
     * @param {Object} params - { userId, title, body, category, priority, metadata }
     */
    static async notifyUser({ userId, title, body, category = "activity", priority = "medium", metadata = {} }) {
        try {
            console.log(`🔔 Notification Processing: [${category.toUpperCase()}] for User: ${userId}`);
            const user = await User.findById(userId);
            if (!user) {
                console.warn(`⚠️ Notification skipped: User ${userId} not found.`);
                return;
            }

            const preferences = user.notificationPreferences?.[category] || { email: true, push: true, inApp: true };
            console.log(`📜 User Preferences for ${category}:`, preferences);

            // 1. In-App Notification (Always save to DB if preference is on)
            if (preferences.inApp) {
                await Notification.create({
                    userId,
                    title,
                    body,
                    category,
                    priority,
                    metadata
                });
                console.log(`✅ In-App Notification saved to DB.`);

                // Socket emission for real-time bell update
                try {
                    const io = getIO();
                    io.to(userId.toString()).emit("notification_received", { title, body, category, priority, metadata });
                } catch (e) {
                    // console.warn("Socket notification failed:", e.message);
                }
            }

            // 2. Push Notification (FCM)
            if (preferences.push && user.fcmTokens && user.fcmTokens.length > 0) {
                const sendPromises = user.fcmTokens.map(async (token) => {
                    try {
                        const message = {
                            token,
                            notification: { title, body },
                            data: { ...metadata, click_action: "FLUTTER_NOTIFICATION_CLICK" },
                            webpush: {
                                notification: {
                                    title,
                                    body,
                                    icon: "/logo.png"
                                }
                            }
                        };
                        await admin.messaging().send(message);
                        console.log(`🚀 Push Notification sent to token: ${token.substring(0, 10)}...`);
                    } catch (fcmError) {
                        console.error(`❌ FCM Error for token ${token}:`, fcmError.message);
                        // If token is invalid/expired, we could remove it from DB here
                        if (fcmError.code === 'messaging/registration-token-not-registered' || fcmError.code === 'messaging/invalid-argument') {
                            console.log(`🗑️ Removing stale FCM token from user ${userId}`);
                            await User.findByIdAndUpdate(userId, { $pull: { fcmTokens: token } });
                        }
                    }
                });
                await Promise.allSettled(sendPromises);
            }

            // 3. Email Notification
            if (preferences.email && user.email) {
                try {
                    const subject = `[Punt Mate] ${title}`;
                    await sendEmail(user.email, subject, body, `<h1>${title}</h1><p>${body}</p>`);
                    console.log(`📧 Email Notification sent to: ${user.email}`);
                } catch (emailError) {
                    console.error(`❌ Email Error for user ${userId}:`, emailError.message);
                }
            }

            console.log(`🏁 Notification process finished for user ${userId}`);

        } catch (error) {
            console.error("NotificationService Error:", error);
        }
    }

    /**
     * Broadcast notification to multiple users (e.g., new results)
     * @param {Object} params - { filter, title, body, category, metadata }
     */
    static async broadcast(params) {
        const { filter = {}, title, body, category, metadata } = params;

        // Find users matching filter (e.g. those who opted in for results)
        // Usually, we iterate in chunks for scalability
        const users = await User.find({ ...filter, status: "active" }).select("_id fcmTokens email notificationPreferences");

        const notifications = users.map(user =>
            this.notifyUser({ userId: user._id, title, body, category, metadata })
        );

        await Promise.allSettled(notifications);
    }
}

export default NotificationService;
