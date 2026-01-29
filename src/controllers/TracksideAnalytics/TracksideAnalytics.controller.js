import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";

const MODELS = [NSW, VIC, ACT];

// Helper to get sorted runners by position
const getRunnersByPosition = (runners = []) => {
    return runners
        .filter((r) => r.horseNo && r.horseNo !== 0)
        .sort((a, b) => a.position - b.position);
};

// Helper to process stats
const processStats = (acc, combo, gameIndex, date) => {
    if (!acc[combo]) {
        acc[combo] = {
            count: 0,
            lastIndex: -1,
            lastDate: null,
            gaps: [],
        };
    }
    const entry = acc[combo];

    // Calculate gap
    let gap;
    if (entry.lastIndex === -1) {
        gap = 0; // No gap yet
    } else {
        gap = gameIndex - entry.lastIndex;
        entry.gaps.push(gap);
    }

    entry.count++;
    entry.lastIndex = gameIndex;
    entry.lastDate = date;
};

// Helper to format response
const formatTop10 = (statsMap, totalGames) => {
    return Object.entries(statsMap)
        .map(([combo, data]) => {
            const wins = data.count;
            // Average Drought: Average of gaps?
            // Or TotalGames / Wins?
            // "Avg games between hits" = TotalGames / Wins is a good approximation for "Frequency".
            // But standard "Average Drought" usually means Average of the gaps.
            // If gaps = [10, 5, 20], avg = 11.6.  (3 hits, 2 gaps).
            // Total span = 35. Total games approx 35.
            // Simple metric: Math.round(totalGames / wins).
            const avgDrought = Math.round(totalGames / wins);

            const currentDrought = totalGames - data.lastIndex;

            // Longest Drought: Max gap found + potentially current drought if it's longer
            const maxHistoricalGap = data.gaps.length > 0 ? Math.max(...data.gaps) : 0;
            const longestDrought = Math.max(maxHistoricalGap, currentDrought);

            return {
                combination: combo,
                winPercentage: ((wins / totalGames) * 100).toFixed(1),
                averageDrought: avgDrought,
                currentDrought: currentDrought,
                longestDrought: longestDrought,
                lastAppeared: currentDrought, // Games ago
                lastAppearedDate: data.lastDate, // Actual date/time
                entries: combo.split("-").map(Number), // For frontend if needed
            };
        })
        .sort((a, b) => parseFloat(b.winPercentage) - parseFloat(a.winPercentage))
        .slice(0, 10);
};

export const getTop10Exotics = async (req, res) => {
    try {
        // Fetch all race data from all states
        // Note: Fetching ALL data might be heavy. For "Top 10", we need significant history.
        // Maybe limit to last 2000-5000 games?
        // User requested "Top 10 Trackside Exotic Data". Implies "All Time" or "Significant Range".
        // Previous code fetched ALL records: `await M.find({}, { runners: 1 })`.
        // I will do the same but combine them sorted by time.

        let allRaces = [];
        for (const M of MODELS) {
            const races = await M.find({}, { numbers: 1, runners: 1, createdAt: 1, date: 1 }).lean();
            allRaces = allRaces.concat(races);
        }

        // Sort by Date/CreatedAt
        allRaces.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const totalGames = allRaces.length;

        console.log(`Analyzing ${totalGames} Trackside races for Analytics...`);

        const stats = {
            Quinella: {}, // Boxed
            Exacta: {},   // Exact
            Trifecta: {}, // Boxed
            FirstFour: {} // Boxed
        };

        // Pre-fetch check
        console.log("Analyzing race data...");

        allRaces.forEach((race, index) => {
            let nums = race.numbers || [];

            // Fallback to runners if numbers is empty
            if (nums.length < 2 && race.runners && race.runners.length > 0) {
                const sortedRunners = getRunnersByPosition(race.runners);
                nums = sortedRunners.map(r => r.horseNo);
            }

            if (nums.length < 2) return;

            const r1 = nums[0];
            const r2 = nums[1];

            // Use race.date if available, otherwise createdAt
            const raceDate = race.date || race.createdAt;

            // Quinella (Boxed Top 2)
            const qCombo = [r1, r2].sort((a, b) => a - b).join("-");
            processStats(stats.Quinella, qCombo, index, raceDate);

            // Exacta (Ordered Top 2)
            const eCombo = `${r1}-${r2}`;
            processStats(stats.Exacta, eCombo, index, raceDate);

            if (nums.length >= 3) {
                const r3 = nums[2];
                // Trifecta (Boxed Top 3)
                const tCombo = [r1, r2, r3].sort((a, b) => a - b).join("-");
                processStats(stats.Trifecta, tCombo, index, raceDate);

                if (nums.length >= 4) {
                    const r4 = nums[3];
                    // First Four (Boxed Top 4)
                    const fCombo = [r1, r2, r3, r4].sort((a, b) => a - b).join("-");
                    processStats(stats.FirstFour, fCombo, index, raceDate);
                }
            }
        });

        const responseData = {
            Quinella: formatTop10(stats.Quinella, totalGames),
            Exacta: formatTop10(stats.Exacta, totalGames),
            Trifecta: formatTop10(stats.Trifecta, totalGames),
            "First Four": formatTop10(stats.FirstFour, totalGames),
        };

        res.json({
            success: true,
            totalGames,
            data: responseData,
        });

    } catch (error) {
        console.error("Trackside Analytics Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTracksideHorseEntryDetails = async (req, res) => {
    try {
        const { horseNo } = req.params;
        const horseId = parseInt(horseNo);

        if (isNaN(horseId) || horseId < 1 || horseId > 12) {
            return res.status(400).json({ success: false, message: "Invalid horse number" });
        }

        let allRaces = [];
        for (const M of MODELS) {
            const races = await M.find({}, { runners: 1, numbers: 1, createdAt: 1, date: 1, gameNumber: 1, drawNumber: 1 }).lean();
            allRaces = allRaces.concat(races);
        }

        // Sort by time (asc) to calculate droughts
        allRaces.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const totalGames = allRaces.length;

        let hits = [];
        let gaps = [];
        let lastHitIndex = -1;
        let maxGap = 0;

        allRaces.forEach((race, index) => {
            let position = null;

            // Try runners first
            const runner = (race.runners || []).find(r => Number(r.horseNo) === horseId);
            if (runner && runner.position) {
                position = runner.position;
            } else if (race.numbers && race.numbers.length > 0) {
                // Fallback to numbers array (Index 0 = 1st, Index 1 = 2nd, Index 2 = 3rd)
                const numIdx = race.numbers.indexOf(horseId);
                if (numIdx !== -1) {
                    position = numIdx + 1;
                }
            }

            if (position && [1, 2, 3].includes(position)) {
                // It's a hit (Win or Place)
                const hitInfo = {
                    date: race.date || race.createdAt,
                    raceNumber: race.gameNumber || race.drawNumber,
                    position: position,
                    type: position === 1 ? "Win" : "Place",
                    index: index
                };
                hits.push(hitInfo);

                if (lastHitIndex !== -1) {
                    const gap = index - lastHitIndex - 1;
                    gaps.push(gap);
                    if (gap > maxGap) maxGap = gap;
                }
                lastHitIndex = index;
            }
        });

        const currentDrought = lastHitIndex === -1 ? totalGames : (totalGames - 1 - lastHitIndex);
        const longestDrought = Math.max(maxGap, currentDrought);

        // Average Drought: average gap between hits
        const avgDrought = gaps.length > 0
            ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
            : (hits.length > 0 ? Math.round(totalGames / hits.length) : totalGames);

        // Get last 5 hits in reverse order (newest first)
        const last5Hits = hits.slice(-5).reverse();

        // Add drought for each of the last 5 results
        const last5WithDroughts = last5Hits.map((hit) => {
            const hitIdxInHits = hits.findIndex(h => h.index === hit.index);
            // Drought since previous hit or from the start of history
            const droughtSincePrevious = hitIdxInHits > 0
                ? hits[hitIdxInHits].index - hits[hitIdxInHits - 1].index - 1
                : hit.index;

            return {
                date: hit.date,
                raceNumber: hit.raceNumber,
                type: hit.type,
                position: hit.position,
                drought: Math.max(0, droughtSincePrevious)
            };
        });

        res.json({
            success: true,
            data: {
                horseId,
                currentDrought,
                averageDrought: avgDrought,
                longestDrought,
                last5Results: last5WithDroughts,
                totalHits: hits.length,
                totalGames
            }
        });

    } catch (error) {
        console.error("Trackside Horse Details Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
