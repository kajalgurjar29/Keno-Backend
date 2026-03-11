import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";

const allCollections = {
    ACT: ACT,
    NSW: NSW,
    VIC: VIC,
};

const toFiniteNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const parseDateToDayNumber = (value) => {
    if (!value) return null;

    if (value instanceof Date && Number.isFinite(value.getTime())) {
        return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / 86400000;
    }

    const raw = String(value).trim();
    const ymd = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymd) {
        const y = Number(ymd[1]);
        const m = Number(ymd[2]);
        const d = Number(ymd[3]);
        return Date.UTC(y, m - 1, d) / 86400000;
    }

    const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
        const d = Number(dmy[1]);
        const m = Number(dmy[2]);
        const y = Number(dmy[3]);
        return Date.UTC(y, m - 1, d) / 86400000;
    }

    const ts = Date.parse(raw);
    if (Number.isFinite(ts)) {
        const dt = new Date(ts);
        return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) / 86400000;
    }

    return null;
};

const compareNullableNumbers = (a, b) => {
    if (a !== null && b !== null && a !== b) return a - b;
    if (a !== null && b === null) return -1;
    if (a === null && b !== null) return 1;
    return 0;
};

const compareTracksideRaces = (a, b) => {
    const dayA = parseDateToDayNumber(a.date ?? a.createdAt);
    const dayB = parseDateToDayNumber(b.date ?? b.createdAt);
    const dayDiff = compareNullableNumbers(dayA, dayB);
    if (dayDiff !== 0) return dayDiff;

    const raceNoA = toFiniteNumber(a.gameNumber ?? a.drawNumber);
    const raceNoB = toFiniteNumber(b.gameNumber ?? b.drawNumber);
    const raceNoDiff = compareNullableNumbers(raceNoA, raceNoB);
    if (raceNoDiff !== 0) return raceNoDiff;

    const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : null;
    const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : null;
    const createdAtDiff = compareNullableNumbers(createdAtA, createdAtB);
    if (createdAtDiff !== 0) return createdAtDiff;

    return String(a._id || "").localeCompare(String(b._id || ""));
};

const getRunnersByPosition = (runners = []) => {
    return runners
        .filter((r) => r.horseNo && r.horseNo !== 0)
        .sort((a, b) => a.position - b.position);
};

export const analyzeTracksideHistoricalFrequency = async (req, res) => {
    try {
        const { pos1, pos2, pos3, pos4, location = "ALL", recentCount = null } = req.query;

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
        let allRacesRaw = [];
        const modelsToFetch = location === "ALL" ? [NSW, VIC, ACT] : (allCollections[location] ? [allCollections[location]] : [NSW]);

        for (const M of modelsToFetch) {
            // No limit - get full history for dynamic analysis
            const races = await M.find({}, { numbers: 1, runners: 1, createdAt: 1, date: 1, gameNumber: 1, drawNumber: 1, gameId: 1, gameName: 1, dividends: 1, payouts: 1, location: 1 }).lean();
            allRacesRaw = allRacesRaw.concat(races);
        }

        // De-duplicate by gameId
        const uniqueRacesMap = new Map();
        allRacesRaw.forEach(r => {
            const id = r.gameId || `${r.gameNumber}_${r.date}`;
            if (!uniqueRacesMap.has(id)) {
                uniqueRacesMap.set(id, r);
            } else {
                const existing = uniqueRacesMap.get(id);
                if (!existing.dividends && r.dividends) existing.dividends = r.dividends;
                if (!existing.payouts && r.payouts) existing.payouts = r.payouts;
            }
        });

        const allRacesSorted = Array.from(uniqueRacesMap.values()).sort(compareTracksideRaces);

        // Process ALL races for global stats BEFORE slicing
        const processedFull = allRacesSorted.map((r, idx) => {
            let nums = r.numbers || [];
            if (nums.length < 4 && r.runners && r.runners.length > 0) {
                nums = getRunnersByPosition(r.runners).map(run => run.horseNo);
            }
            return {
                idx,
                raceNo: r.gameNumber || r.drawNumber,
                date: r.date || r.createdAt,
                nums: nums.slice(0, 4),
                dividends: r.dividends || {},
                payouts: r.payouts || {},
                location: r.location,
                hasDividendData: Object.values(r.payouts || {}).some(v => v > 0) || Object.values(r.dividends || {}).some(v => v !== "" && v !== "$0.00")
            };
        });

        // Calculate Global Fallback Average Dividends for the whole database
        const globalBetTypeStats = {
            quinella: { sum: 0, count: 0 },
            exacta: { sum: 0, count: 0 },
            trifecta: { sum: 0, count: 0 },
            first4: { sum: 0, count: 0 }
        };

        processedFull.forEach(race => {
            ["quinella", "exacta", "trifecta", "first4"].forEach(type => {
                let val = 0;
                if (race.payouts && race.payouts[type] && !isNaN(parseFloat(race.payouts[type]))) {
                    val = parseFloat(race.payouts[type]);
                } else if (race.dividends && race.dividends[type]) {
                    const cleanVal = String(race.dividends[type]).replace(/[^\d.]/g, "");
                    val = parseFloat(cleanVal);
                }
                if (val > 0) {
                    globalBetTypeStats[type].sum += val;
                    globalBetTypeStats[type].count++;
                }
            });
        });

        const globalFallbacks = {};
        Object.entries(globalBetTypeStats).forEach(([type, stats]) => {
            globalFallbacks[type] = stats.count > 0 ? (stats.sum / stats.count) : 0;
        });

        // Now handle the "Recent" slice if requested for the visible output
        let processed = [...processedFull];
        if (recentCount && !isNaN(parseInt(recentCount))) {
            processed = processedFull.slice(-parseInt(recentCount));
        }
        const totalGames = processed.length;

        const getCombos = (type) => {
            if (type === "Quinella") {
                const uniquePairs = new Set();
                p1.forEach(x => {
                    p2.forEach(y => {
                        if (x !== y) {
                            const pair = [x, y].sort((a, b) => a - b).join("-");
                            uniquePairs.add(pair);
                        }
                    });
                });
                return uniquePairs.size;
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

        // Count total games in the window that have dividend data
        const totalGamesWithDivs = processed.filter(r => r.hasDividendData).length;
        // Also know how many in FULL history have divs (for fallback average)
        const totalFullGamesWithDivs = processedFull.filter(r => r.hasDividendData).length;

        types.forEach(type => {
            const hits = []; // indices relative to 'processed' array
            const fullHistoryHitsIndices = []; // indices relative to 'processedFull' array

            let totalDivValue = 0; // Value from hits in the window
            let divCount = 0; // Count of hits with divs in the window

            let fullHistoryDivValue = 0; // Value from hits in the FULL history
            let fullHistoryDivCount = 0; // Count of hits with divs in the FULL history

            const stateBreakdown = { NSW: 0, VIC: 0, ACT: 0 };

            // Pass 1: Scan FULL History for robust average dividend for THIS combination
            const divKey = type.toLowerCase();
            processedFull.forEach(race => {
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
                    fullHistoryHitsIndices.push(race.idx);
                    let val = 0;
                    if (race.payouts && race.payouts[divKey] && !isNaN(parseFloat(race.payouts[divKey]))) {
                        val = parseFloat(race.payouts[divKey]);
                    } else if (race.dividends && race.dividends[divKey]) {
                        const cleanVal = String(race.dividends[divKey]).replace(/[^\d.]/g, "");
                        val = parseFloat(cleanVal);
                    }

                    if (val > 0) {
                        fullHistoryDivValue += val;
                        fullHistoryDivCount++;
                    }
                }
            });

            // Pass 2: Filter for the visible window
            const windowMinIdx = processed[0].idx;
            const windowMaxIdx = processed[processed.length - 1].idx;

            fullHistoryHitsIndices.forEach(idx => {
                if (idx >= windowMinIdx && idx <= windowMaxIdx) {
                    const raceIdxInProcessed = processed.findIndex(r => r.idx === idx);
                    if (raceIdxInProcessed !== -1) {
                        hits.push(raceIdxInProcessed);
                        anyHitIndices.add(raceIdxInProcessed);

                        const race = processed[raceIdxInProcessed];
                        let val = 0;
                        if (race.payouts && race.payouts[divKey] && !isNaN(parseFloat(race.payouts[divKey]))) {
                            val = parseFloat(race.payouts[divKey]);
                        } else if (race.dividends && race.dividends[divKey]) {
                            const cleanVal = String(race.dividends[divKey]).replace(/[^\d.]/g, "");
                            val = parseFloat(cleanVal);
                        }
                        if (val > 0) {
                            totalDivValue += val;
                            divCount++;
                        }
                        if (race.location) stateBreakdown[race.location]++;
                    }
                }
            });

            const count = hits.length;
            const avgGms = count > 0 ? Number((totalGames / count).toFixed(1)) : totalGames;
            const currDrought = count > 0 ? (totalGames - 1 - hits[hits.length - 1]) : totalGames;

            // Gap/Drought Analysis
            let maxGap = 0;
            for (let i = 1; i < hits.length; i++) {
                const gap = hits[i] - hits[i - 1] - 1;
                if (gap > maxGap) maxGap = gap;
            }
            const longestDrought = Math.max(maxGap, currDrought);

            const comboType = type === "First4" ? "FirstFour" : type;
            const combos = getCombos(comboType);

            const flexiPercentNum = combos > 0 ? (100 / combos) : 0;
            const flexiPercentStr = (flexiPercentNum % 1 === 0 ? flexiPercentNum : flexiPercentNum.toFixed(2)) + "%";

            // Dynamic average for THIS specific combination from full history
            let baseAvgDiv = fullHistoryDivCount > 0 ? (fullHistoryDivValue / fullHistoryDivCount) : 0;
            // If this combo has NEVER hit with a dividend, use the global fallback for the bet type
            if (baseAvgDiv === 0) baseAvgDiv = globalFallbacks[divKey] || 0;

            const flexiAvgDiv = baseAvgDiv * (flexiPercentNum / 100);

            const winProbability = totalGames > 0
                ? ((count / totalGames) * 100).toFixed(2) + "%"
                : "0.00%";

            // IMPORTANT: For Profit and ROI, only use games that actually have dividend data
            // This avoids skewing ROI negatively when recent dividends are missing from scraper.
            const totalInvestment = combos * totalGamesWithDivs;
            const netProfit = totalDivValue - totalInvestment;
            const roiPercent = totalInvestment > 0 ? ((totalDivValue / totalInvestment) * 100).toFixed(2) + "%" : "0.00%";

            // PROJECTED: Estimate missing dividends using the robust avgDiv calculated above
            const hitsWithNoDivs = hits.filter(hIdx => !processed[hIdx].hasDividendData).length;
            const projectedReturn = totalDivValue + (hitsWithNoDivs * baseAvgDiv);
            const projectedInvestment = combos * totalGames;
            const projectedNetProfit = projectedReturn - projectedInvestment;
            const projectedROI = projectedInvestment > 0 ? ((projectedReturn / projectedInvestment) * 100).toFixed(2) + "%" : "0.00%";



            results[type] = {
                hits: count,
                avgGms: avgGms,
                currentDrought: currDrought,
                longestDrought: longestDrought,
                flexiPercent: flexiPercentStr,
                avgDiv: "$" + flexiAvgDiv.toFixed(2),
                last5Hits: hits.slice(-5).reverse().map(idx => {
                    const race = processed[idx];
                    const hIdx = hits.indexOf(idx);
                    const divKey = type.toLowerCase();

                    let displayDiv = "$0.00";
                    if (race.payouts && race.payouts[divKey] && race.payouts[divKey] > 0) {
                        displayDiv = "$" + parseFloat(race.payouts[divKey]).toFixed(2);
                    } else if (race.dividends && race.dividends[divKey] && race.dividends[divKey] !== "$0.00" && race.dividends[divKey] !== "") {
                        displayDiv = race.dividends[divKey];
                    } else {
                        displayDiv = "$" + baseAvgDiv.toFixed(2);
                    }

                    const cleanDiv = parseFloat(displayDiv.replace(/[^\d.]/g, "")) || 0;
                    const flexiDiv = cleanDiv * (flexiPercentNum / 100);

                    return {
                        raceNumber: race.raceNo,
                        date: race.date,
                        result: race.nums,
                        dividend: displayDiv,
                        avgDiv: "$" + flexiDiv.toFixed(2),
                        droughtAtHit: hIdx > 0 ? (idx - hits[hIdx - 1] - 1) : idx,
                        flexiPercent: flexiPercentStr
                    };
                })
            };
        });

        // Overall Summary Logic
        const combinedHits = Array.from(anyHitIndices).sort((a, b) => a - b);
        const combinedAvg = combinedHits.length > 0 ? (totalGames / combinedHits.length).toFixed(1) : totalGames;

        // Calculate hits in the last 1000 races for the summary
        const hitsLast1000Count = combinedHits.filter(i => i >= totalGames - 1000).length;
        const combinedAvg1000 = hitsLast1000Count > 0 ? (Math.min(totalGames, 1000) / hitsLast1000Count).toFixed(1) : (totalGames > 0 ? Math.min(totalGames, 1000) : 0);

        // Summary Totals across all active types
        let totalReturnAll = 0;
        let totalInvestmentAll = 0;
        let projectedReturnAll = 0;
        let totalInvestmentFullAll = 0;

        Object.values(results).forEach(r => {
            // These would be used for formattedSummary below
            totalInvestmentAll++; // (simplified since we removed the properties from results)
        });

        // Let's recalculate the required profit fields globally instead of relying on individual result objects that were stripped
        processed.forEach(race => {
            if (!race.hasDividendData) return;
            types.forEach(type => {
                const divKey = type.toLowerCase();
                const comboType = type === "First4" ? "FirstFour" : type;
                const combos = getCombos(comboType);
                if (combos === 0) return;

                let isHit = false;
                const n = race.nums;
                if (n.length >= 2) {
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
                }

                totalInvestmentAll += combos;

                if (isHit) {
                    let val = 0;
                    if (race.payouts && race.payouts[divKey] && !isNaN(parseFloat(race.payouts[divKey]))) {
                        val = parseFloat(race.payouts[divKey]);
                    } else if (race.dividends && race.dividends[divKey]) {
                        const cleanVal = String(race.dividends[divKey]).replace(/[^\d.]/g, "");
                        val = parseFloat(cleanVal);
                    }
                    totalReturnAll += val;
                }
            });
        });

        // We estimate projected Return
        types.forEach(type => {
            const divKey = type.toLowerCase();
            const comboType = type === "First4" ? "FirstFour" : type;
            const combos = getCombos(comboType);
            totalInvestmentFullAll += combos * totalGames;

            // Re-calculate fullHistory average for this combination to use for projection
            let typeDivSum = 0;
            let typeDivCount = 0;
            processedFull.forEach(race => {
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
                    let val = 0;
                    if (race.payouts && race.payouts[divKey] && !isNaN(parseFloat(race.payouts[divKey]))) val = parseFloat(race.payouts[divKey]);
                    else if (race.dividends && race.dividends[divKey]) val = parseFloat(String(race.dividends[divKey]).replace(/[^\d.]/g, ""));
                    if (val > 0) { typeDivSum += val; typeDivCount++; }
                }
            });
            let baseAvgDiv = typeDivCount > 0 ? (typeDivSum / typeDivCount) : (globalFallbacks[divKey] || 0);

            // add projected
            processed.forEach(race => {
                if (race.hasDividendData) return;
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
                if (isHit) projectedReturnAll += baseAvgDiv;
            });
        });
        projectedReturnAll += totalReturnAll;

        const netProfitAll = totalReturnAll - totalInvestmentAll;
        const roiPercentAll = totalInvestmentAll > 0 ? ((totalReturnAll / totalInvestmentAll) * 100).toFixed(2) + "%" : "0.00%";

        const projectedProfitAll = projectedReturnAll - totalInvestmentFullAll;
        const projectedROIAll = totalInvestmentFullAll > 0 ? ((projectedReturnAll / totalInvestmentFullAll) * 100).toFixed(2) + "%" : "0.00%";

        return res.json({
            success: true,
            analyticsMode: recentCount ? `Recent ${recentCount} Games` : "Full Historical",
            summary: {
                totalGamesProcessed: totalGames,
                combinedHits: combinedHits.length,
                hitsLast1000: `1 in ${combinedAvg1000} races`,
                avgGames: combinedAvg,
                formattedSummary: `Across ${totalGames.toLocaleString()} races, your exotic strategy hit ${combinedHits.length.toLocaleString()} times. Total Actual Profit: $${netProfitAll.toFixed(2)} (${roiPercentAll} ROI). Projected Profit (including pending dividends): $${projectedProfitAll.toFixed(2)} (${projectedROIAll} ROI).`
            },
            data: results
        });
    } catch (error) {
        console.error("Historical Frequency Power Analytics Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
