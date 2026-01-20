import Alert from "../../models/Alert.model.js";
import NSWTrackSide from "../../models/TrackSideResult.NSW.model.js";
import VICTrackSide from "../../models/TrackSideResult.VIC.model.js";
import ACTTrackSide from "../../models/TrackSideResult.ACT.model.js";
import NSWKeno from "../../models/NSWkenoDrawResult.model.js";
import VICKeno from "../../models/VICkenoDrawResult.model.js";
import ACTKeno from "../../models/ACTkenoDrawResult.model.js";
import SAKeno from "../../models/SAkenoDrawResult.model.js";

const TRACKSIDE_MODELS = [NSWTrackSide, VICTrackSide, ACTTrackSide];
const KENO_MODELS = [NSWKeno, VICKeno, ACTKeno, SAKeno];

// Helper to calculate Trackside drought
const calculateTracksideDrought = async (betType, entries) => {
    // Sort entries for consistent matching
    const targetCombo = [...entries].sort((a, b) => a - b).join("-");

    // We need to check all Trackside models to find the LATEST occurrence across all states
    // OR, if the user wants alerts per state, we'd need that info. 
    // Assuming "Trackside" is general for now, but usually it's state specific? 
    // The client req says "Trackside Combinations", implies general or user picks.
    // We will search across ALL models for the most recent appearance.

    let globalLastAppearedIndex = -1;
    let totalGamesChecked = 0; // This is tricky across multiple DBs.
    // Simplified approach: Get the total count of games, and find the most recent game index where it won.

    // Actually, "Drought" is "Games since last appeared".
    // We need the most recent game across ALL states where this combo appeared.
    // And the TOTAL number of games played since then?
    // If games are running concurrently in multiple states, "Games ago" is relative to the stream of games.
    // Let's assume we count "Total Games" as sum of all games in all DBs.
    // And "Last Appeared" is how many games have passed since the last hit.

    // 1. Get total combined game count (approximate for "games ago")
    // 2. Find the ONE most recent document across all collections that matches the combo.

    // However, simpler logic might be: Just find the most recent Match.
    // Then count how many documents have a createdAt > Match.createdAt.

    let mostRecentHitDate = null;

    for (const Model of TRACKSIDE_MODELS) {
        // We need to filter where the runners match the bet type results.
        // Quinella: Top 2
        // Exacta: Top 2 (order matters? usually for Exotics alerts, users box them or pick exact. standard is boxed for "drought" usually, but let's assume exact or boxed? Client says "1-2-3")
        // Let's assume Boxed for numbers provided (1-2-3 matches 1,2,3 in any order in Top 3).
        // Or Exact? Client said "Entry numbers (e.g. 1-2-3)".
        // Let's stick to "Runners in Top X contain these numbers".

        // For now, let's look for exact match of the sorted runners in the top positions.
        // This loops through all games is expensive. We need a better query.

        // Let's assume "1-2-3" means Trifecta winning numbers 1, 2, 3 (sorted).

        // Query: 
        // Find one latest game where runners in position 0..N match our numbers.
        let query = {};
        const n = entries.length;

        // Construct query to find a race where top N runners match 'entries'
        // runners is an array of objects { horseNo, position ... }
        // We want a document where the set of horseNos in positions 1..N matches 'entries'.

        // This is hard to do with simple find.
        // Alternative: fetch recent 1000 games and check in memory? Too slow.
        // Aggregation?

        // Let's use a simplified approach as calculating "Exact Drought" across 3 DBs is heavy.
        // Find the latest result sorted by date.

        // If we assume the DB has a `createdAt`.

        const results = await Model.find().sort({ createdAt: -1 }).limit(1000); // Check last 1000 games per state? start with that.

        for (const game of results) {
            // Check if this game is a hit
            // Get top N runners
            const topRunners = game.runners
                .filter(r => r.position <= n && r.position > 0)
                .map(r => r.horseNo)
                .sort((a, b) => a - b);

            if (topRunners.join("-") === targetCombo) {
                if (!mostRecentHitDate || game.createdAt > mostRecentHitDate) {
                    mostRecentHitDate = game.createdAt;
                }
                break; // Found latest in this model
            }
        }
    }

    if (!mostRecentHitDate) {
        return { currentDrought: "1000+", lastAppeared: "1000+" }; // Or "Never"
    }

    // Count games since that date across all models
    let gamesSince = 0;
    for (const Model of TRACKSIDE_MODELS) {
        const count = await Model.countDocuments({ createdAt: { $gt: mostRecentHitDate } });
        gamesSince += count;
    }

    return { currentDrought: gamesSince, lastAppeared: gamesSince };
};

// Helper for Keno Drought
const calculateKenoDrought = async (alertType, targetValue) => {
    // This seems to refer to specific alert types like "Head/Tail drought" or "Number drought".
    // For now, we'll return mock data or calculate basics if we know the rules.
    // Client mentions "40-game number drought".
    // If it's a number drought, we check when that number last appeared.

    // Parse alertType to find the target number if applicable.
    // e.g. "Number 7 Drought" -> find last time 7 appeared.

    return { currentDrought: 0, status: "Active" }; // Placeholder logic to be refined
};

export const createAlert = async (req, res) => {
    try {
        const { userId, gameType, betType, combinations, alertType, targetValue } = req.body;

        const newAlert = await Alert.create({
            userId,
            gameType,
            betType,
            combinations,
            alertType,
            targetValue,
        });

        const alertResponse = newAlert.toObject();
        if (gameType === "KENO") {
            delete alertResponse.combinations;
            delete alertResponse.betType;
        } else {
            delete alertResponse.alertType;
            delete alertResponse.targetValue;
        }

        res.status(201).json({ success: true, alert: alertResponse });
    } catch (error) {
        console.error("Create Alert Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getUserAlerts = async (req, res) => {
    try {
        const { userId } = req.params;
        const alerts = await Alert.find({ userId });

        const tracksideAlerts = [];
        const kenoAlerts = [];

        for (const alert of alerts) {
            if (alert.gameType === "TRACKSIDE") {
                const droughtData = await calculateTracksideDrought(alert.betType, alert.combinations);
                const alertObj = alert.toObject();
                delete alertObj.alertType;
                delete alertObj.targetValue;
                tracksideAlerts.push({
                    ...alertObj,
                    ...droughtData,
                });
            } else {
                const droughtData = await calculateKenoDrought(alert.alertType, alert.targetValue);
                const alertObj = alert.toObject();
                delete alertObj.combinations;
                delete alertObj.betType;
                kenoAlerts.push({
                    ...alertObj,
                    ...droughtData,
                });
            }
        }

        // Limit to 3 as per req
        res.json({
            success: true,
            data: {
                trackside: tracksideAlerts.slice(0, 3),
                keno: kenoAlerts.slice(0, 3),
            },
        });
    } catch (error) {
        console.error("Get User Alerts Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
