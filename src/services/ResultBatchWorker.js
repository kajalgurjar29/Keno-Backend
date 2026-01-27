import eventBus, { EVENTS } from "../utils/eventBus.js";
import NotificationService from "./NotificationService.js";

/**
 * Result Batch Worker
 * Sends a summary notification every 5 new results
 */
class ResultBatchWorker {
    static counters = {
        KENO: 0,
        TRACKSIDE: 0
    };

    static init() {
        eventBus.on(EVENTS.NEW_RESULT_PUBLISHED, async (payload) => {
            const { type } = payload;

            if (this.counters[type] !== undefined) {
                this.counters[type]++;
                console.log(`📈 [${type}] Draw received. Batch Progress: ${this.counters[type]}/5`);

                if (this.counters[type] >= 5) {
                    console.log(`🎁 [${type}] BATCH REACHED! Triggering mass notification...`);

                    await NotificationService.broadcast({
                        filter: { "notificationPreferences.results.push": true },
                        title: "🔥 New Results are coming!",
                        body: `5 new ${type} results have just been published. Please check them now!`,
                        category: "results",
                        priority: "medium",
                        metadata: { type, batchUpdate: true }
                    });

                    // Reset counter
                    this.counters[type] = 0;
                }
            }
        });
    }
}

export default ResultBatchWorker;
