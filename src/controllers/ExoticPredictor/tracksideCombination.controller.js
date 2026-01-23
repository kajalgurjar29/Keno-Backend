import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";
import _ from "lodash";

const allCollections = [
    { location: "ACT", model: ACT },
    { location: "NSW", model: NSW },
    { location: "VIC", model: VIC },
];

const getRunnersByPosition = (runners = []) => {
    return runners
        .filter((r) => r.horseNo && r.horseNo !== 0)
        .sort((a, b) => a.position - b.position);
};

export const generateTracksideExoticPredictions = async (req, res) => {
    try {
        const {
            betType = "Quinella",
            minRacesSinceLastOccurrence = 50,
            noOfCombinations = 5,
            location = "NSW", // Default to NSW for Trackside
        } = req.body;

        const collection = allCollections.find(c => c.location === location);
        if (!collection) {
            return res.status(400).json({ success: false, message: "Invalid location" });
        }

        const data = await collection.model.find().sort({ createdAt: -1 }).limit(1000).lean();

        if (!data.length) {
            return res.status(404).json({ success: false, message: "No data found" });
        }

        const combos = generateFilteredCombinations(
            data,
            betType,
            parseInt(minRacesSinceLastOccurrence),
            parseInt(noOfCombinations)
        );

        res.json({ success: true, location, gameType: "trackside", data: combos });
    } catch (err) {
        console.error("Trackside Prediction Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

function generateFilteredCombinations(data, betType, minRaces, comboCount) {
    // Map data to numbers
    const processedData = data.map(d => {
        const sortedRunners = getRunnersByPosition(d.runners);
        return { numbers: sortedRunners.map(r => r.horseNo) };
    });

    const recentData = processedData.slice(0, minRaces);
    // Trackside has horse numbers 1-12
    const allNumbers = _.range(1, 13);

    const comboSize = betType === "Trifecta" ? 3 : betType === "First Four" ? 4 : 2;

    const allCombos = generateCombinations(allNumbers, comboSize, betType);

    const recentCombos = new Set();
    recentData.forEach(d => {
        if (d.numbers.length >= comboSize) {
            const winningNums = d.numbers.slice(0, comboSize);
            // For Quinella, order doesn't matter, but generateCombinations for Quinella returns sorted combos.
            // For others, it's exact order.
            if (betType === "Quinella") {
                recentCombos.add([...winningNums].sort((a, b) => a - b).join("-"));
            } else {
                recentCombos.add(winningNums.join("-"));
            }
        }
    });

    const filtered = allCombos.filter(c => !recentCombos.has(c.join("-")));

    return _.sampleSize(filtered, comboCount).map(combo => {
        // Calculate drought for the selected combo
        let drought = 0;
        for (let i = 0; i < processedData.length; i++) {
            const drawNumbers = processedData[i].numbers;
            const winningNums = drawNumbers.slice(0, comboSize);

            let isHit = false;
            if (betType === "Quinella") {
                const sortedWinning = [...winningNums].sort((a, b) => a - b);
                isHit = combo.join("-") === sortedWinning.join("-");
            } else {
                isHit = combo.join("-") === winningNums.join("-");
            }

            if (isHit) break;
            drought++;
        }

        return {
            combination: combo,
            key: combo.join("-"),
            currentDrought: drought
        };
    });
}

function generateCombinations(numbers, size, betType) {
    if (betType === "Quinella") {
        // Standard combination (order doesn't matter, sorted)
        const results = [];
        const helper = (combo, start) => {
            if (combo.length === size) {
                results.push([...combo]);
                return;
            }
            for (let i = start; i < numbers.length; i++) {
                helper([...combo, numbers[i]], i + 1);
            }
        };
        helper([], 0);
        return results;
    } else {
        // Permutation (order matters)
        const results = [];
        const helper = (combo, remaining) => {
            if (combo.length === size) {
                results.push([...combo]);
                return;
            }
            for (let i = 0; i < remaining.length; i++) {
                const newRemaining = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
                helper([...combo, remaining[i]], newRemaining);
            }
        };
        helper([], numbers);
        return results;
    }
}
