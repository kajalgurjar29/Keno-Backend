import ActivityWorker from "./ActivityWorker.js";
import AlertEvaluator from "./AlertEvaluator.js";
import ResultBatchWorker from "./ResultBatchWorker.js";
import NotificationService from "./NotificationService.js";
import eventBus, { EVENTS } from "../utils/eventBus.js";

/**
 * Main Service Initializer
 */
export const initializeServices = () => {
    console.log("🛠️ Initializing Notification and Alert Services...");

    // Start Background Workers
    ActivityWorker.init();
    AlertEvaluator.init();
    ResultBatchWorker.init();

    // Generic Result Broadcast Listener
    // When a scraper publishes a result, we notify people who want general results
    eventBus.on(EVENTS.NEW_RESULT_PUBLISHED, async (payload) => {
        const { type, location, data } = payload;

        await NotificationService.broadcast({
            filter: { "notificationPreferences.results.push": true }, // Only people who opted in
            title: `New ${type} Result!`,
            body: `${location} Result published for Game #${data.gameNumber || data.draw}. Check it out!`,
            category: "results",
            metadata: { type, location, id: data.draw }
        });
    });

    console.log("✅ All Services Initialized.");
};
