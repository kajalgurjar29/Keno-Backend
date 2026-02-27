import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";

const MODELS = [NSW, VIC, ACT];

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

// Helper to get sorted runners by position
const getRunnersByPosition = (runners = []) => {
    return runners
        .filter((r) => r.horseNo && r.horseNo !== 0)
        .sort((a, b) => a.position - b.position);
};

// Helper to process stats
const processStats = (acc, combo, gameIndex, date, isLatestDay, dividendStr = null) => {
    if (!acc[combo]) {
        acc[combo] = {
            count: 0,
            lastIndex: -1,
            lastDate: null,
            gaps: [],
            divSum: 0,
            divCount: 0,
            last24h: 0
        };
    }
    const entry = acc[combo];

    // Gap = missed races between two hits
    if (entry.lastIndex !== -1) {
        const gap = Math.max(0, gameIndex - entry.lastIndex - 1);
        entry.gaps.push(gap);
    }

    entry.count++;
    entry.lastIndex = gameIndex;
    entry.lastDate = date;
    if (isLatestDay) entry.last24h++;

    // Process Dividend
    if (dividendStr && typeof dividendStr === "string" && dividendStr.includes("$")) {
        const val = parseFloat(dividendStr.replace("$", "").replace(",", ""));
        if (!isNaN(val)) {
            entry.divSum += val;
            entry.divCount++;
        }
    }
};

// Helper to format response
const formatTop10 = (statsMap, totalGames, totalDays, latestDate, recent360StatsMap = {}, recent1000StatsMap = {}, recentGamesCount360 = 360, recentGamesCount1000 = 1000) => {
    return Object.entries(statsMap)
        .map(([combo, data]) => {
            const wins = data.count;
            const avgGames = wins > 0 ? Number((totalGames / wins).toFixed(2)) : totalGames;
            const currentDrought = totalGames - 1 - data.lastIndex;
            const maxHistoricalGap = data.gaps.length > 0 ? Math.max(...data.gaps) : 0;
            const longestDrought = Math.max(maxHistoricalGap, currentDrought);

            const recentData360 = recent360StatsMap[combo] || { count: 0 };
            const wins360 = recentData360.count;

            const recentData1000 = recent1000StatsMap[combo] || { count: 0 };
            const wins1000 = recentData1000.count;

            const avgDiv = data.divCount > 0 ? (data.divSum / data.divCount).toFixed(2) : "0.00";

            return {
                combination: combo,
                avgHitsDay: (wins / (totalDays || 1)).toFixed(3),
                hits24h: data.last24h || 0,
                dividend: `$${avgDiv}`,
                hits: wins,
                avgGames: avgGames,
                hits1000: wins1000,
                hits360: wins360,
                currentDrought: Math.max(0, currentDrought),
                longestDrought: longestDrought,
                winPercentage: ((wins / totalGames) * 100).toFixed(2),
                lastAppeared: Math.max(0, currentDrought),
                lastAppearedDate: data.lastDate,
                entries: combo.split("-").map(Number),
            };
        });
};

export const getTop10Exotics = async (req, res) => {
    try {
        const { location = "ALL" } = req.query;
        let modelsToUse = MODELS;

        if (location !== "ALL") {
            const locMap = { "NSW": NSW, "VIC": VIC, "ACT": ACT };
            if (locMap[location.toUpperCase()]) {
                modelsToUse = [locMap[location.toUpperCase()]];
            }
        }

        let allRacesRaw = [];
        for (const M of modelsToUse) {
            const races = await M.find({}, { numbers: 1, runners: 1, createdAt: 1, date: 1, gameNumber: 1, drawNumber: 1, location: 1, gameId: 1, dividends: 1 }).lean();
            allRacesRaw = allRacesRaw.concat(races);
        }

        const uniqueRacesMap = new Map();
        allRacesRaw.forEach(r => {
            const id = r.gameId || `${r.gameNumber}_${r.date}`;
            if (!uniqueRacesMap.has(id)) {
                uniqueRacesMap.set(id, r);
            } else {
                const existing = uniqueRacesMap.get(id);
                if (!existing.dividends && r.dividends) existing.dividends = r.dividends;
            }
        });

        const allRaces = Array.from(uniqueRacesMap.values()).sort(compareTracksideRaces);
        const totalGames = allRaces.length;

        console.log(`Analyzing ${totalGames} Trackside races for Analytics...`);

        const stats = { Quinella: {}, Exacta: {}, Trifecta: {}, FirstFour: {} };
        const recent360Stats = { Quinella: {}, Exacta: {}, Trifecta: {}, FirstFour: {} };
        const recent1000Stats = { Quinella: {}, Exacta: {}, Trifecta: {}, FirstFour: {} };

        const threshold360 = Math.max(0, totalGames - 360);
        const threshold1000 = Math.max(0, totalGames - 1000);

        const uniqueDates = [...new Set(allRaces.map(r => r.date).filter(Boolean))].sort();
        const totalDays = uniqueDates.length || 1;
        const latestDate = uniqueDates[uniqueDates.length - 1];

        allRaces.forEach((race, index) => {
            let nums = race.numbers || [];
            if (nums.length < 2 && race.runners && race.runners.length > 0) {
                const sortedRunners = getRunnersByPosition(race.runners);
                nums = sortedRunners.map(r => r.horseNo);
            }

            if (nums.length < 2) return;

            const r1 = nums[0];
            const r2 = nums[1];
            const raceDate = race.date || race.createdAt;
            const isLatestDay = race.date === latestDate;

            const processAllTypes = (targetMap) => {
                const divs = race.dividends || {};

                const qCombo = [r1, r2].sort((a, b) => a - b).join("-");
                processStats(targetMap.Quinella, qCombo, index, raceDate, isLatestDay, divs.quinella);

                const eCombo = `${r1}-${r2}`;
                processStats(targetMap.Exacta, eCombo, index, raceDate, isLatestDay, divs.exacta);

                if (nums.length >= 3) {
                    const r3 = nums[2];
                    const tCombo = `${r1}-${r2}-${r3}`;
                    processStats(targetMap.Trifecta, tCombo, index, raceDate, isLatestDay, divs.trifecta);

                    if (nums.length >= 4) {
                        const r4 = nums[3];
                        const fCombo = `${r1}-${r2}-${r3}-${r4}`;
                        processStats(targetMap.FirstFour, fCombo, index, raceDate, isLatestDay, divs.first4);
                    }
                }
            };

            processAllTypes(stats);
            if (index >= threshold360) processAllTypes(recent360Stats);
            if (index >= threshold1000) processAllTypes(recent1000Stats);
        });

        const recentGamesCount360 = Math.min(totalGames, 360);
        const recentGamesCount1000 = Math.min(totalGames, 1000);

        const formatAndSort = (data, total, tDays, lDate, r360, r1000, rg360, rg1000) => {
            return formatTop10(data, total, tDays, lDate, r360, r1000, rg360, rg1000)
                .sort((a, b) => b.hits - a.hits) // Ranked by combinations that hit the most (all time)
                .slice(0, 10)
                .map((item, index) => {
                    const { entries, ...rest } = item;
                    return {
                        Rank: index + 1,
                        Entries: entries,
                        ClientComment: "Live Data",
                        ...rest,
                        RNK: index + 1,
                        rank: index + 1,
                    };
                });
        };

        const responseData = {
            Quinella: formatAndSort(stats.Quinella, totalGames, totalDays, latestDate, recent360Stats.Quinella, recent1000Stats.Quinella, recentGamesCount360, recentGamesCount1000),
            Exacta: formatAndSort(stats.Exacta, totalGames, totalDays, latestDate, recent360Stats.Exacta, recent1000Stats.Exacta, recentGamesCount360, recentGamesCount1000),
            Trifecta: formatAndSort(stats.Trifecta, totalGames, totalDays, latestDate, recent360Stats.Trifecta, recent1000Stats.Trifecta, recentGamesCount360, recentGamesCount1000),
            "First Four": formatAndSort(stats.FirstFour, totalGames, totalDays, latestDate, recent360Stats.FirstFour, recent1000Stats.FirstFour, recentGamesCount360, recentGamesCount1000),
        };

        res.json({
            success: true,
            totalGames,
            recentGamesCount360,
            recentGamesCount1000,
            data: responseData,
        });

    } catch (error) {
        console.error("Trackside Analytics Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTop10Exotics24h = async (req, res) => {
    try {
        const { location = "ALL" } = req.query;
        let modelsToUse = MODELS;

        if (location !== "ALL") {
            const locMap = { "NSW": NSW, "VIC": VIC, "ACT": ACT };
            if (locMap[location.toUpperCase()]) {
                modelsToUse = [locMap[location.toUpperCase()]];
            }
        }

        let allRacesRaw = [];
        for (const M of modelsToUse) {
            const races = await M.find({}, { numbers: 1, runners: 1, createdAt: 1, date: 1, gameNumber: 1, drawNumber: 1, location: 1, gameId: 1, dividends: 1 })
                .sort({ createdAt: -1 })
                .lean();
            allRacesRaw = allRacesRaw.concat(races);
        }

        const uniqueRacesMap = new Map();
        allRacesRaw.forEach(r => {
            const id = r.gameId || `${r.gameNumber}_${r.date}`;
            if (!uniqueRacesMap.has(id)) {
                uniqueRacesMap.set(id, r);
            } else {
                const existing = uniqueRacesMap.get(id);
                if (!existing.dividends && r.dividends) existing.dividends = r.dividends;
            }
        });

        let allRaces = Array.from(uniqueRacesMap.values());
        allRaces.sort(compareTracksideRaces);

        // Keep the recent endpoint aligned to a fixed recent window of unique races.
        if (allRaces.length > 360) {
            allRaces = allRaces.slice(allRaces.length - 360);
        }

        const totalGames = allRaces.length;

        const stats = { Quinella: {}, Exacta: {}, Trifecta: {}, FirstFour: {} };
        const recent360Stats = { Quinella: {}, Exacta: {}, Trifecta: {}, FirstFour: {} };
        const recent1000Stats = { Quinella: {}, Exacta: {}, Trifecta: {}, FirstFour: {} };

        const threshold360 = Math.max(0, totalGames - 360);
        const threshold1000 = Math.max(0, totalGames - 1000);

        const uniqueDates = [...new Set(allRaces.map(r => r.date).filter(Boolean))].sort();
        const totalDays = uniqueDates.length || 1;
        const latestDate = uniqueDates[uniqueDates.length - 1];

        allRaces.forEach((race, index) => {
            let nums = race.numbers || [];
            if (nums.length < 2 && race.runners && race.runners.length > 0) {
                const sortedRunners = getRunnersByPosition(race.runners);
                nums = sortedRunners.map(r => r.horseNo);
            }

            if (nums.length < 2) return;

            const r1 = nums[0];
            const r2 = nums[1];
            const raceDate = race.date || race.createdAt;
            const isLatestDay = race.date === latestDate;

            const processAllTypes = (targetMap) => {
                const divs = race.dividends || {};

                const qCombo = [r1, r2].sort((a, b) => a - b).join("-");
                processStats(targetMap.Quinella, qCombo, index, raceDate, isLatestDay, divs.quinella);

                const eCombo = `${r1}-${r2}`;
                processStats(targetMap.Exacta, eCombo, index, raceDate, isLatestDay, divs.exacta);

                if (nums.length >= 3) {
                    const r3 = nums[2];
                    const tCombo = `${r1}-${r2}-${r3}`;
                    processStats(targetMap.Trifecta, tCombo, index, raceDate, isLatestDay, divs.trifecta);

                    if (nums.length >= 4) {
                        const r4 = nums[3];
                        const fCombo = `${r1}-${r2}-${r3}-${r4}`;
                        processStats(targetMap.FirstFour, fCombo, index, raceDate, isLatestDay, divs.first4);
                    }
                }
            };

            processAllTypes(stats);
            if (index >= threshold360) processAllTypes(recent360Stats);
            if (index >= threshold1000) processAllTypes(recent1000Stats);
        });

        const recentGamesCount360 = Math.min(totalGames, 360);
        const recentGamesCount1000 = Math.min(totalGames, 1000);

        const formatAndSort24h = (data, total, tDays, lDate, r360, r1000, rg360, rg1000) => {
            return formatTop10(data, total, tDays, lDate, r360, r1000, rg360, rg1000)
                .sort((a, b) => b.hits - a.hits) // Ranked by combinations that hit the most (all time)
                .slice(0, 10)
                .map((item, index) => {
                    const { entries, ...rest } = item;
                    return {
                        Rank: index + 1,
                        Entries: entries,
                        ClientComment: "Live Data",
                        ...rest,
                        RNK: index + 1,
                        rank: index + 1,
                    };
                });
        };

        const responseData = {
            Quinella: formatAndSort24h(stats.Quinella, totalGames, totalDays, latestDate, recent360Stats.Quinella, recent1000Stats.Quinella, recentGamesCount360, recentGamesCount1000),
            Exacta: formatAndSort24h(stats.Exacta, totalGames, totalDays, latestDate, recent360Stats.Exacta, recent1000Stats.Exacta, recentGamesCount360, recentGamesCount1000),
            Trifecta: formatAndSort24h(stats.Trifecta, totalGames, totalDays, latestDate, recent360Stats.Trifecta, recent1000Stats.Trifecta, recentGamesCount360, recentGamesCount1000),
            "First Four": formatAndSort24h(stats.FirstFour, totalGames, totalDays, latestDate, recent360Stats.FirstFour, recent1000Stats.FirstFour, recentGamesCount360, recentGamesCount1000),
        };

        res.json({
            success: true,
            totalGames,
            recentGamesCount360,
            recentGamesCount1000,
            data: responseData,
        });

    } catch (error) {
        console.error("Trackside Analytics 24h Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTracksideHorseEntryDetails = async (req, res) => {
    try {
        const { horseNo } = req.params;
        const { location = "ALL" } = req.query;
        const horseId = parseInt(horseNo);

        if (isNaN(horseId) || horseId < 1 || horseId > 12) {
            return res.status(400).json({ success: false, message: "Invalid horse number" });
        }

        let modelsToUse = MODELS;
        if (location !== "ALL") {
            const locMap = { "NSW": NSW, "VIC": VIC, "ACT": ACT };
            if (locMap[location.toUpperCase()]) {
                modelsToUse = [locMap[location.toUpperCase()]];
            }
        }

        let allRaces = [];
        for (const M of modelsToUse) {
            const races = await M.find({}, { runners: 1, numbers: 1, createdAt: 1, date: 1, gameNumber: 1, drawNumber: 1, gameName: 1, gameId: 1, location: 1 }).lean();
            allRaces = allRaces.concat(races);
        }

        // Sort by time (asc) to calculate droughts
        allRaces.sort(compareTracksideRaces);
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
                    raceNumber: (race.gameNumber !== undefined && race.gameNumber !== null) ? `Game ${race.gameNumber}` : (race.drawNumber || race.gameName || race.gameId || "N/A"),
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
            : (hits.length > 0 ? currentDrought : totalGames);

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

export const getTracksideDashboardStats = async (req, res) => {
    try {
        const { location = "NSW" } = req.query;
        const Model = location === "VIC" ? VIC : (location === "ACT" ? ACT : NSW);

        // Fetch recent races for the table (last 10)
        const recentRacesRaw = await Model.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        if (!recentRacesRaw.length) {
            return res.json({
                success: true,
                location,
                latestRace: null,
                recentRaces: [],
                charts: { numberFrequency: { odd: 0, even: 0 }, oddEvenDistribution: [] }
            });
        }

        const formatResult = (r) => {
            let nums = [];
            if (r.numbers && r.numbers.length > 0) {
                nums = r.numbers.slice(0, 4);
            } else if (r.runners) {
                nums = getRunnersByPosition(r.runners).map(run => run.horseNo).slice(0, 4);
            }
            return nums;
        };

        const latestRaceData = recentRacesRaw[0];
        const latestNums = formatResult(latestRaceData);

        // Fetch larger sample for stats (last 100 races)
        const statsData = await Model.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        let oddWins = 0;
        let evenWins = 0;

        statsData.forEach(race => {
            const winners = formatResult(race);
            winners.forEach(num => {
                if (num % 2 === 0) evenWins++;
                else oddWins++;
            });
        });

        const totalWinners = oddWins + evenWins;

        res.json({
            success: true,
            location,
            latestRace: {
                id: latestRaceData.gameNumber || latestRaceData.drawNumber,
                date: latestRaceData.date || latestRaceData.createdAt,
                numbers: latestNums,
            },
            recentRaces: recentRacesRaw.map(r => ({
                id: r.gameNumber || r.drawNumber || r.gameName || r.gameId || "",
                type: "Trackside",
                time: r.date || r.createdAt,
                numbers: formatResult(r)
            })),
            charts: {
                numberFrequency: {
                    odd: oddWins,
                    even: evenWins,
                    oddPercent: totalWinners ? ((oddWins / totalWinners) * 100).toFixed(1) : 0,
                    evenPercent: totalWinners ? ((evenWins / totalWinners) * 100).toFixed(1) : 0
                },
                oddEvenDistribution: [
                    { name: "Odd", value: oddWins, percentage: totalWinners ? ((oddWins / totalWinners) * 100).toFixed(1) : 0 },
                    { name: "Even", value: evenWins, percentage: totalWinners ? ((evenWins / totalWinners) * 100).toFixed(1) : 0 }
                ]
            }
        });

    } catch (error) {
        console.error("Trackside Dashboard Stats Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRecentTracksideResults = async (req, res) => {
    try {
        const { location = "NSW" } = req.query;
        const Model = location === "VIC" ? VIC : (location === "ACT" ? ACT : NSW);

        const results = await Model.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const formatResult = (r) => {
            let nums = [];
            if (r.numbers && r.numbers.length > 0) {
                nums = r.numbers.slice(0, 4);
            } else if (r.runners) {
                nums = getRunnersByPosition(r.runners).map(run => run.horseNo).slice(0, 4);
            }
            return nums;
        };

        res.json({
            success: true,
            location,
            data: results.map(r => ({
                id: r.gameNumber || r.drawNumber || r.gameName || r.gameId || "",
                type: "Trackside",
                time: r.date || r.createdAt,
                numbers: formatResult(r)
            }))
        });

    } catch (error) {
        console.error("Trackside Recent Results Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};




