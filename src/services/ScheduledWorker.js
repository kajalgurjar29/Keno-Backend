import NotificationService from "./NotificationService.js";
import User from "../models/User.model.js";
import NSWKeno from "../models/NSWkenoDrawResult.model.js";

/**
 * Scheduled Worker
 * Handles daily/weekly summary notifications
 */
class ScheduledWorker {
    /**
     * Send daily summary of results to opted-in users
     */
    static async sendDailySummary() {
        console.log("📅 Generating daily summary notifications...");

        // 1. Get stats for the last 24 hours
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const kenoCount = await NSWKeno.countDocuments({ createdAt: { $gt: last24h } });

        const title = "📊 Your Daily Punting Summary";
        const body = `In the last 24 hours, ${kenoCount} Keno draws took place. Open the app to see the latest trends and hot numbers!`;

        // 2. Broadcast to users who want scheduled summaries
        // (Assuming a preference exists or general interest)
        await NotificationService.broadcast({
            filter: { "notificationPreferences.results.email": true },
            title,
            body,
            category: "results",
            metadata: { type: "summary", period: "daily" }
        });
    }
}

export default ScheduledWorker;
