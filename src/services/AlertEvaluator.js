import Alert from "../models/Alert.model.js";
import NotificationService from "./NotificationService.js";
import eventBus, { EVENTS } from "../utils/eventBus.js";

/**
 * Alert Evaluator Service
 * Listens for new results and checks against user-defined alerts (Patterns/Numbers/Exotics)
 */
class AlertEvaluator {
    static init() {
        // Listen for new results published by scrapers
        eventBus.on(EVENTS.NEW_RESULT_PUBLISHED, async (payload) => {
            const { type, location, data } = payload;
            console.log(`🔍 Evaluating alerts for ${type} in ${location}...`);
            await this.evaluateAlerts(type, location, data);
        });
    }

    static async evaluateAlerts(gameType, location, resultData) {
        try {
            // 1. Fetch all ACTIVE alerts for this game type
            const activeAlerts = await Alert.find({
                gameType: gameType.toLowerCase(),
                status: "Active"
            });

            console.log(`🧐 Checking Result against ${activeAlerts.length} active ${gameType} alerts...`);

            for (const alert of activeAlerts) {
                let isTriggered = false;
                let triggerMessage = "";

                if (gameType === "TRACKSIDE") {
                    isTriggered = this.checkTracksideAlert(alert, resultData);
                    if (isTriggered) triggerMessage = `Your Trackside ${alert.betType} alert for [${alert.combinations.join(', ')}] was triggered!`;
                } else if (gameType === "KENO") {
                    isTriggered = this.checkKenoAlert(alert, resultData);
                    if (isTriggered) triggerMessage = `Your Keno alert [${alert.alertType}] has reached its target!`;
                }

                if (isTriggered) {
                    await this.triggerAlert(alert, triggerMessage, resultData);
                }
            }
        } catch (error) {
            console.error("Alert Evaluation Failed:", error);
        }
    }

    /**
     *Logic for Trackside Pattern Matching
     */
    static checkTracksideAlert(alert, resultData) {
        const { betType, combinations } = alert;
        const runners = resultData.runners || [];
        const topN = combinations.length;

        // Extract winner combinations from result
        const actualTopRunners = runners
            .filter(r => r.position <= topN && r.position > 0)
            .map(r => r.horseNo)
            .sort((a, b) => a - b);

        const targetCombo = [...combinations].sort((a, b) => a - b);

        // Simple boxed match for now (order doesn't matter for specific drought alerts usually)
        return actualTopRunners.length === targetCombo.length &&
            actualTopRunners.every((val, index) => val === targetCombo[index]);
    }

    /**
     * Logic for Keno Stats/Pattern Matching
     */
    static checkKenoAlert(alert, resultData) {
        const { alertType, targetValue } = alert;
        const numbers = resultData.numbers || [];

        // Example: "Number X Drought"
        // In a real system, we'd check DB history here.
        // For simple "Result Alert" (e.g. notify me when number 7 appears):
        if (alertType.toLowerCase().includes("number")) {
            return numbers.includes(targetValue);
        }

        // Example: "Heads/Tails Win"
        if (alertType.toLowerCase().includes("heads") && resultData.result === "Heads wins") return true;
        if (alertType.toLowerCase().includes("tails") && resultData.result === "Tails wins") return true;

        return false;
    }

    static async triggerAlert(alert, message, resultData) {
        console.log(`🎯 ALERT TRIGGERED for user ${alert.userId}: ${message}`);

        // 1. Send Notification via Multi-Channel Service
        await NotificationService.notifyUser({
            userId: alert.userId,
            title: "🎯 Alert Triggered!",
            body: message,
            category: "alerts",
            priority: "high",
            metadata: {
                alertId: alert._id,
                gameType: alert.gameType,
                gameNumber: resultData.gameNumber || resultData.draw,
                location: resultData.location || "NSW"
            }
        });

        // 2. Mark alert as Triggered (if one-time) or update lastTriggeredAt
        // For persistence/re-arming logic:
        // alert.status = "Triggered"; // Uncomment if you want alerts to stop after one hit
        // await alert.save();
    }
}

export default AlertEvaluator;
