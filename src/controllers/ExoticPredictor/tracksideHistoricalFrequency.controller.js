import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";

const allCollections = {
    ACT: ACT,
    NSW: NSW,
    VIC: VIC,
};

const getRunnersByPosition = (runners = []) => {
    return runners
        .filter((r) => r.horseNo && r.horseNo !== 0)
        .sort((a, b) => a.position - b.position);
};

export const analyzeTracksideHistoricalFrequency = async (req, res) => {
    try {
        const { location = "NSW", entries = [], betType = "Quinella" } = req.body || {};

        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ success: false, message: "entries must be a non-empty array" });
        }

        const size = entries.length;
        const normalizedTarget = [...entries].map(Number);
        if (betType === "Quinella") {
            normalizedTarget.sort((a, b) => a - b);
        }

        const Model = allCollections[location];
        if (!Model) {
            return res.status(400).json({ success: false, message: "Invalid location" });
        }

        const allRaces = await Model.find().sort({ createdAt: 1 }).lean();

        if (!allRaces.length) {
            return res.status(404).json({ success: false, message: "No race data found" });
        }

        let occurrences = 0;
        let lastSeenIndex = -1;
        const occurrenceIndexes = [];

        for (let i = 0; i < allRaces.length; i++) {
            const race = allRaces[i];
            // Use the numbers array directly if available, otherwise fallback to runners
            let winners = [];
            if (race.numbers && race.numbers.length >= size) {
                winners = race.numbers.slice(0, size);
            } else if (race.runners) {
                const sortedRunners = getRunnersByPosition(race.runners);
                winners = sortedRunners.map(r => r.horseNo).slice(0, size);
            }

            let isHit = false;
            if (winners.length === size) {
                if (betType === "Quinella") {
                    const sortedWinners = [...winners].sort((a, b) => a - b);
                    isHit = normalizedTarget.join("-") === sortedWinners.join("-");
                } else {
                    // Trifecta, First Four (Exact Order)
                    isHit = normalizedTarget.join("-") === winners.join("-");
                }
            }

            if (isHit) {
                occurrences += 1;
                lastSeenIndex = i;
                occurrenceIndexes.push(i);
            }
        }

        const totalDraws = allRaces.length;
        const lastOccurrenceRacesAgo = lastSeenIndex === -1 ? totalDraws : totalDraws - lastSeenIndex;

        let averageInterval = 0;
        if (occurrenceIndexes.length > 1) {
            let sum = 0;
            for (let i = 1; i < occurrenceIndexes.length; i++) {
                sum += occurrenceIndexes[i] - occurrenceIndexes[i - 1];
            }
            averageInterval = Math.round(sum / (occurrenceIndexes.length - 1));
        }

        const avgEvery = occurrences > 0 ? Math.round(totalDraws / occurrences) : 0;
        const winningPct = occurrences > 0 ? Math.round((occurrences / totalDraws) * 100) : 0;

        return res.status(200).json({
            success: true,
            data: {
                combination: normalizedTarget.join("-"),
                betType,
                size,
                totalDraws,
                occurrences,
                avgEvery,
                lastOccurrenceRacesAgo,
                averageInterval,
                winningPercentage: winningPct,
                appeared: occurrences > 0,
            },
        });
    } catch (error) {
        console.error("Trackside Historical Frequency Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
