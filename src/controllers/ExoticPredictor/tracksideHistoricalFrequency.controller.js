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
        const { pos1, pos2, pos3, pos4, location = "ALL" } = req.query;

        const parsePos = (str) => {
            if (!str) return [];
            return str.split(",")
                .map(n => parseInt(n.trim()))
                .filter(n => !isNaN(n) && n >= 1 && n <= 12);
        };

        const p1 = parsePos(pos1);
        const p2 = parsePos(pos2);
        const p3 = parsePos(pos3);
        const p4 = parsePos(pos4);

        if (p1.length === 0 && p2.length === 0 && p3.length === 0 && p4.length === 0) {
            return res.status(400).json({ success: false, message: "Please select at least one runner." });
        }

        // Fetch races
        let allRacesMap = new Map();
        const modelsToFetch = location === "ALL" ? [NSW, VIC, ACT] : (allCollections[location] ? [allCollections[location]] : [NSW]);

        for (const M of modelsToFetch) {
            const races = await M.find({}, { numbers: 1, runners: 1, createdAt: 1, date: 1, gameNumber: 1, drawNumber: 1 }).lean();
            races.forEach(race => {
                const key = race.gameNumber || race.drawNumber || race._id.toString();
                if (!allRacesMap.has(key) || (race.runners && race.runners.length > 0 && (!allRacesMap.get(key).runners || allRacesMap.get(key).runners.length === 0))) {
                    allRacesMap.set(key, race);
                }
            });
        }

        let allRaces = Array.from(allRacesMap.values());
        allRaces.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const totalGames = allRaces.length;

        // Process races
        const processed = allRaces.map((r, idx) => {
            let nums = r.numbers || [];
            if (nums.length < 4 && r.runners && r.runners.length > 0) {
                nums = getRunnersByPosition(r.runners).map(run => run.horseNo);
            }
            return {
                idx,
                raceNo: r.gameNumber || r.drawNumber,
                date: r.date || r.createdAt,
                nums: nums.slice(0, 4)
            };
        });

        const getCombos = (type) => {
            if (type === "Quinella") {
                const union = Array.from(new Set([...p1, ...p2]));
                return union.length < 2 ? 0 : (union.length * (union.length - 1)) / 2;
            }
            const countDistinct = (current, remainingPos) => {
                if (remainingPos.length === 0) return 1;
                let sum = 0;
                const nextOptions = remainingPos[0];
                nextOptions.forEach(opt => {
                    if (!current.includes(opt)) {
                        sum += countDistinct([...current, opt], remainingPos.slice(1));
                    }
                });
                return sum;
            };
            if (type === "Exacta") return countDistinct([], [p1, p2]);
            if (type === "Trifecta") return countDistinct([], [p1, p2, p3]);
            if (type === "FirstFour") return countDistinct([], [p1, p2, p3, p4]);
            return 0;
        };

        const unionP1P2 = new Set([...p1, ...p2]);
        const types = ["Quinella", "Exacta", "Trifecta", "First4"];
        const results = {};
        const anyHitIndices = new Set();

        types.forEach(type => {
            const hits = [];
            processed.forEach(race => {
                const n = race.nums;
                if (n.length < 2) return;
                let isHit = false;
                if (type === "Quinella") {
                    const top2 = n.slice(0, 2);
                    if (unionP1P2.has(top2[0]) && unionP1P2.has(top2[1])) isHit = true;
                } else if (type === "Exacta") {
                    if (p1.includes(n[0]) && p2.includes(n[1]) && n[0] !== n[1]) isHit = true;
                } else if (type === "Trifecta") {
                    if (n.length >= 3 && p1.includes(n[0]) && p2.includes(n[1]) && p3.includes(n[2]) && (new Set(n.slice(0, 3)).size === 3)) isHit = true;
                } else if (type === "First4") {
                    if (n.length >= 4 && p1.includes(n[0]) && p2.includes(n[1]) && p3.includes(n[2]) && p4.includes(n[3]) && (new Set(n.slice(0, 4)).size === 4)) isHit = true;
                }
                if (isHit) {
                    hits.push(race.idx);
                    anyHitIndices.add(race.idx);
                }
            });

            const count = hits.length;
            const avgGms = count > 0 ? Number((totalGames / count).toFixed(1)) : totalGames;
            const last1k = hits.filter(i => i >= totalGames - 1000).length;
            const currDrought = count > 0 ? (totalGames - 1 - hits[hits.length - 1]) : totalGames;
            let maxGap = 0;
            for (let i = 1; i < hits.length; i++) {
                const gap = hits[i] - hits[i - 1] - 1;
                if (gap > maxGap) maxGap = gap;
            }
            const longestDrought = Math.max(maxGap, currDrought);

            const comboType = type === "First4" ? "FirstFour" : type;
            const combos = getCombos(comboType);

            results[type] = {
                hits: count,
                avgGms: avgGms,
                hitsLast1k: last1k,
                currentDrought: currDrought,
                longestDrought: longestDrought,
                combos,
                flexiPercent: combos > 0 ? ((1 / combos) * 100).toFixed(2) + "%" : "0.00%",
                avgDiv: "$0.00",
                last5Hits: hits.slice(-5).reverse().map(idx => {
                    const race = processed[idx];
                    const hIdx = hits.indexOf(idx);
                    return {
                        raceNumber: race.raceNo,
                        date: race.date,
                        result: race.nums,
                        dividend: "$0.00",
                        drought: hIdx > 0 ? (idx - hits[hIdx - 1] - 1) : idx,
                        avgDrought: avgGms,
                        longestDrought
                    };
                })
            };
        });

        const combinedHits = Array.from(anyHitIndices).sort((a, b) => a - b);
        const combinedLast1k = combinedHits.filter(i => i >= totalGames - 1000).length;
        const combinedAvg = combinedHits.length > 0 ? (totalGames / combinedHits.length).toFixed(1) : totalGames;

        return res.json({
            success: true,
            summary: {
                totalGames,
                combinedHits: combinedHits.length,
                combinedHitsLast1k: combinedLast1k,
                combinedAvgGames: combinedAvg,
                formattedSummary: `Across the data set, at least one of your exotic bets hit ${combinedHits.length.toLocaleString()} times (1 in ${combinedAvg} games on average). In the last 1,000 games, they hit ${combinedLast1k} times (1 in ${(combinedLast1k > 0 ? (1000 / combinedLast1k).toFixed(1) : 0)} on average).`
            },
            data: results
        });
    } catch (error) {
        console.error("Historical Frequency Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

