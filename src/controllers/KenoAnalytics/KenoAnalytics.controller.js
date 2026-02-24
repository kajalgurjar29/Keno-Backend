import NSWKeno from "../../models/NSWkenoDrawResult.model.js";
import VICKeno from "../../models/VICkenoDrawResult.model.js";
import ACTKeno from "../../models/ACTkenoDrawResult.model.js";
import SAKeno from "../../models/SAkenoDrawResult.model.js";

const MODELS_MAP = {
    "NSW": NSWKeno,
    "VIC": VICKeno,
    "ACT": ACTKeno,
    "SA": SAKeno
};

const ALL_MODELS = [NSWKeno, VICKeno, ACTKeno, SAKeno];

// Helper to process stats for a number
const processNumberStats = (acc, number, gameIndex, date) => {
    if (!acc[number]) {
        acc[number] = {
            count: 0,
            lastIndex: -1,
            lastDate: null,
            gaps: [],
        };
    }
    const entry = acc[number];

    if (entry.lastIndex !== -1) {
        // Drought = number of games missed between appearances
        const gap = gameIndex - entry.lastIndex - 1;
        entry.gaps.push(gap);
    }

    entry.count++;
    entry.lastIndex = gameIndex;
    entry.lastDate = date;
};

const formatTop10 = (statsMap, totalGames, sortBy = "hot") => {
    const results = Object.entries(statsMap)
        .map(([num, data]) => {
            const wins = data.count;
            const currentDrought = data.lastIndex === -1 ? totalGames : Math.max(0, totalGames - 1 - data.lastIndex);
            const avgDrought = data.gaps.length > 0
                ? Number((data.gaps.reduce((sum, gap) => sum + gap, 0) / data.gaps.length).toFixed(1))
                : (wins > 0 ? currentDrought : totalGames);
            const maxHistoricalGap = data.gaps.length > 0 ? Math.max(...data.gaps) : 0;
            const longestDrought = Math.max(maxHistoricalGap, currentDrought);

            const lastWinDate = data.lastDate ? (data.lastDate instanceof Date ? data.lastDate.toLocaleDateString('en-AU') : data.lastDate) : "-";

            return {
                number: parseInt(num),
                winPercentage: ((wins / totalGames) * 100).toFixed(2),
                averageDrought: avgDrought,
                currentDrought: currentDrought,
                longestDrought: longestDrought,
                lastAppeared: currentDrought,
                lastAppearedDate: lastWinDate,
                lastWin: lastWinDate, // For consistency
                hits: wins,
                lastIndex: data.lastIndex
            };
        })
        .sort((a, b) => {
            if (sortBy === "hot") {
                // Primary: Highest Hits, Secondary: Most Recent (Smallest Current Drought), Tertiary: Number
                return (b.hits - a.hits) || (a.currentDrought - b.currentDrought) || (a.number - b.number);
            } else {
                // Primary: Highest Current Drought, Secondary: Longest Historical Drought, Tertiary: Lowest Total Hits
                return (b.currentDrought - a.currentDrought) || (b.longestDrought - a.longestDrought) || (a.hits - b.hits);
            }
        })
        .slice(0, 10);

    return results.map((item, index) => {
        const { lastIndex, ...rest } = item;
        return {
            Rank: index + 1,
            Entries: [rest.number],
            ClientComment: "Live Data",
            ...rest,
            RNK: index + 1,
            rank: index + 1,
        }
    });
};

export const getTop10Keno = async (req, res) => {
    try {
        const { location } = req.query;
        let modelsToUse = ALL_MODELS;

        if (location && MODELS_MAP[location.toUpperCase()]) {
            modelsToUse = [MODELS_MAP[location.toUpperCase()]];
        }

        let allGames = [];
        for (const M of modelsToUse) {
            // ONLY use valid draws with 20 numbers
            const games = await M.find({ numbers: { $size: 20 } }, { numbers: 1, createdAt: 1, date: 1 }).lean();
            allGames = allGames.concat(games);
        }

        // Sort by Date (createdAt is most reliable for sequence)
        allGames.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const totalGames = allGames.length;

        if (totalGames === 0) {
            return res.json({
                success: true,
                totalGames: 0,
                data: { top10HotKeno: [], top10ColdKeno: [] }
            });
        }

        console.log(`Analyzing ${totalGames} valid Keno games for ${location || "ALL"} All-time Analytics...`);

        const stats = {};
        for (let i = 1; i <= 80; i++) {
            stats[i] = { count: 0, lastIndex: -1, lastDate: null, gaps: [] };
        }

        allGames.forEach((game, index) => {
            const nums = game.numbers || [];
            const gameDate = game.createdAt || game.date;
            nums.forEach(num => {
                if (stats[num]) {
                    processNumberStats(stats, num, index, gameDate);
                }
            });
        });

        const hotNumbers = formatTop10(stats, totalGames, "hot");
        const coldNumbers = formatTop10(stats, totalGames, "cold");

        res.json({
            success: true,
            totalGames,
            location: location || "ALL",
            data: {
                top10HotKeno: hotNumbers,
                top10ColdKeno: coldNumbers
            }
        });

    } catch (error) {
        console.error("Keno Analytics Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTop10Keno24h = async (req, res) => {
    try {
        const { location } = req.query;
        let modelsToUse = ALL_MODELS;

        if (location && MODELS_MAP[location.toUpperCase()]) {
            modelsToUse = [MODELS_MAP[location.toUpperCase()]];
        }

        let allGames = [];
        for (const M of modelsToUse) {
            // ONLY use valid draws with 20 numbers, limit each state to 360 to ensure we have enough for a combined window
            const games = await M.find({ numbers: { $size: 20 } }, { numbers: 1, createdAt: 1, date: 1 })
                .sort({ createdAt: -1 })
                .limit(360)
                .lean();
            allGames = allGames.concat(games);
        }

        // Sort chronologically to process gaps correctly
        allGames.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Limit to exactly the last 360 valid games combined
        if (allGames.length > 360) {
            allGames = allGames.slice(allGames.length - 360);
        }

        const totalGames = allGames.length;

        if (totalGames === 0) {
            return res.json({
                success: true,
                totalGames: 0,
                data: { top10HotKeno: [], top10ColdKeno: [] }
            });
        }

        console.log(`Analyzing ${totalGames} valid Keno games (Last 360) for ${location || "ALL"} Recent Analytics...`);

        const stats = {};
        for (let i = 1; i <= 80; i++) {
            stats[i] = { count: 0, lastIndex: -1, lastDate: null, gaps: [] };
        }

        allGames.forEach((game, index) => {
            const nums = game.numbers || [];
            const gameDate = game.createdAt || game.date;
            nums.forEach(num => {
                if (stats[num]) {
                    processNumberStats(stats, num, index, gameDate);
                }
            });
        });

        const hotNumbers = formatTop10(stats, totalGames, "hot");
        const coldNumbers = formatTop10(stats, totalGames, "cold");

        res.json({
            success: true,
            totalGames,
            location: location || "ALL",
            data: {
                top10HotKeno: hotNumbers,
                top10ColdKeno: coldNumbers
            }
        });

    } catch (error) {
        console.error("Keno Analytics Recent Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
