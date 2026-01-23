import ACTDrawNumber from "../../models/ACTkenoDrawResult.model.js";
import NSWDrawNumber from "../../models/NSWkenoDrawResult.model.js";
import SADrawNumber from "../../models/SAkenoDrawResult.model.js";
import VICDrawNumber from "../../models/VICkenoDrawResult.model.js";
import _ from "lodash";

const allCollections = {
    ACT: ACTDrawNumber,
    NSW: NSWDrawNumber,
    SA: SADrawNumber,
    VIC: VICDrawNumber,
};

export const generateKenoCombinationPredictions = async (req, res) => {
    try {
        const {
            size = 2, // Size of combination (e.g. 2-spot, 3-spot)
            minDrawsSinceLastOccurrence = 100,
            noOfCombinations = 5,
            location = "NSW",
        } = req.body;

        const Model = allCollections[location];
        if (!Model) {
            return res.status(400).json({ success: false, message: "Invalid location" });
        }

        const data = await Model.find().sort({ drawNumber: -1 }).limit(1000).lean();

        if (!data.length) {
            return res.status(404).json({ success: false, message: "No data found" });
        }

        const combos = generateFilteredKenoCombinations(
            data,
            parseInt(size),
            parseInt(minDrawsSinceLastOccurrence),
            parseInt(noOfCombinations)
        );

        res.json({ success: true, location, gameType: "keno", data: combos });
    } catch (err) {
        console.error("Keno Prediction Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

function generateFilteredKenoCombinations(data, size, minDraws, comboCount) {
    const recentData = data.slice(0, minDraws);

    // In Keno, we can't generate ALL combinations of 80 numbers (too many).
    // Instead, we'll pick combinations that appear in the historical data but NOT in the recent data.
    // OR we pick random combinations and verify they are "overdue".

    const allRecentCombos = new Set();
    recentData.forEach(draw => {
        if (draw.numbers && draw.numbers.length >= size) {
            // This is still complex as one draw has many combos.
            // Let's use a simpler approach: 
            // 1. Get numbers that haven't appeared much recently.
            // 2. Generate combos from those.
        }
    });

    // Helper to check if a combo appeared in a draw
    const isComboInDraw = (combo, drawNumbers) => {
        return combo.every(num => drawNumbers.includes(num));
    };

    // Strategy: 
    // 1. Get most frequent numbers that are NOT in the very latest draws.
    // 2. Create sample combos.
    // 3. Verify they haven't appeared in 'minDraws'.

    const candidateNumbers = _.range(1, 81);
    const results = [];
    let attempts = 0;
    const maxAttempts = 1000;

    while (results.length < comboCount && attempts < maxAttempts) {
        attempts++;
        const candidate = _.sampleSize(candidateNumbers, size).sort((a, b) => a - b);
        const candidateKey = candidate.join("-");

        // Check if appeared in recent data
        const isRecent = recentData.some(draw => isComboInDraw(candidate, draw.numbers));

        if (!isRecent) {
            // Calculate drought
            let drought = 0;
            for (let i = 0; i < data.length; i++) {
                if (isComboInDraw(candidate, data[i].numbers)) {
                    break;
                }
                drought++;
            }

            results.push({
                combination: candidate,
                key: candidateKey,
                currentDrought: drought
            });
        }
    }

    return results;
}
