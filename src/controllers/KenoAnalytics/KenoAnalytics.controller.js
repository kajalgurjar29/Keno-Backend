import NSWKeno from "../../models/NSWkenoDrawResult.model.js";
import VICKeno from "../../models/VICkenoDrawResult.model.js";
import ACTKeno from "../../models/ACTkenoDrawResult.model.js";
import SAKeno from "../../models/SAkenoDrawResult.model.js";

const MODELS = [NSWKeno, VICKeno, ACTKeno, SAKeno];

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

    let gap;
    if (entry.lastIndex === -1) {
        gap = 0;
    } else {
        gap = gameIndex - entry.lastIndex;
        entry.gaps.push(gap);
    }

    entry.count++;
    entry.lastIndex = gameIndex;
    entry.lastDate = date;
};

const formatTop10 = (statsMap, totalGames, sortBy = "hot") => {
    return Object.entries(statsMap)
        .map(([num, data]) => {
            const wins = data.count;
            const avgDrought = Math.round(totalGames / (wins || 1));
            const currentDrought = totalGames - data.lastIndex;
            const maxHistoricalGap = data.gaps.length > 0 ? Math.max(...data.gaps) : 0;
            const longestDrought = Math.max(maxHistoricalGap, currentDrought);

            return {
                number: parseInt(num),
                winPercentage: ((wins / totalGames) * 100).toFixed(2),
                averageDrought: avgDrought,
                currentDrought: currentDrought,
                longestDrought: longestDrought,
                lastAppeared: currentDrought,
                lastAppearedDate: data.lastDate,
            };
        })
        .sort((a, b) => {
            if (sortBy === "hot") {
                // Sort by Win % Descending
                return parseFloat(b.winPercentage) - parseFloat(a.winPercentage);
            } else {
                // Sort by Current Drought Descending (Coldest)
                return b.currentDrought - a.currentDrought;
            }
        })
        .slice(0, 10);
};

export const getTop10Keno = async (req, res) => {
    try {
        let allGames = [];
        for (const M of MODELS) {
            const games = await M.find({}, { numbers: 1, createdAt: 1, date: 1 }).lean();
            allGames = allGames.concat(games);
        }

        // Sort by Date
        allGames.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const totalGames = allGames.length;

        console.log(`Analyzing ${totalGames} Keno games for Analytics...`);

        const stats = {};
        // Initialize stats for 1-80 to ensure all are tracked (even if 0 wins)
        for (let i = 1; i <= 80; i++) {
            stats[i] = {
                count: 0,
                lastIndex: -1,
                lastDate: null,
                gaps: [],
            };
        }

        allGames.forEach((game, index) => {
            const nums = game.numbers || [];
            const gameDate = game.date || game.createdAt;

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
