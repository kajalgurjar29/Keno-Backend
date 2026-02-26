import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";

const MODELS = [NSW, VIC, ACT];

export const getTrackSideQuickStats = async (req, res) => {
  try {
    const { location = "ALL" } = req.query;
    let modelsToUse = MODELS;

    if (location !== "ALL") {
      const locMap = { "NSW": NSW, "VIC": VIC, "ACT": ACT };
      if (locMap[location.toUpperCase()]) {
        modelsToUse = [locMap[location.toUpperCase()]];
      }
    }

    const horseMap = {};
    for (let i = 1; i <= 12; i++) {
      horseMap[i] = { horse: i, entries: 0, wins: 0, places: 0, lastWin: null, pos1: 0, pos2: 0, pos3: 0, pos4: 0 };
    }

    let allRacesRaw = [];
    for (const Model of modelsToUse) {
      const races = await Model.find({}, { runners: 1, createdAt: 1, date: 1, gameId: 1, gameNumber: 1 }).lean();
      allRacesRaw = allRacesRaw.concat(races);
    }

    const uniqueRacesMap = new Map();
    allRacesRaw.forEach(r => {
      const id = r.gameId || `${r.gameNumber}_${r.date || r.createdAt}`;
      if (!uniqueRacesMap.has(id)) uniqueRacesMap.set(id, r);
    });

    const allRaces = Array.from(uniqueRacesMap.values());
    const totalRaces = allRaces.length;

    allRaces.forEach(race => {
      if (!race.runners || race.runners.length === 0) return;
      race.runners.forEach(({ horseNo, position }) => {
        if (!horseMap[horseNo]) return;
        const h = horseMap[horseNo];
        h.entries++;
        if (position === 1) {
          h.wins++; h.pos1++;
          const raceDate = race.date || race.createdAt;
          h.lastWin = !h.lastWin || raceDate > h.lastWin ? raceDate : h.lastWin;
        }
        if (position === 2) h.pos2++;
        if (position === 3) h.pos3++;
        if (position === 4) h.pos4++;
        if (position <= 3) h.places++;
      });
    });

    const response = Object.values(horseMap).map((h) => ({
      horse: h.horse,
      summary: {
        entries: h.entries,
        wins: h.wins,
        places: h.places,
        winPercentage: h.entries ? Number(((h.wins / h.entries) * 100).toFixed(2)) : 0,
        lastWin: h.lastWin,
        totalRaces,
      },
      positions: { "1st": h.pos1, "2nd": h.pos2, "3rd": h.pos3, "4th": h.pos4 },
    }));

    res.json({ success: true, location: location.toUpperCase(), totalRaces, data: response });
  } catch (err) {
    console.error("TrackSide QuickStats Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTracksideGraphStats = async (req, res) => {
  try {
    const { location = "ALL" } = req.query;
    let modelsToUse = MODELS;

    if (location !== "ALL") {
      const locMap = { "NSW": NSW, "VIC": VIC, "ACT": ACT };
      if (locMap[location.toUpperCase()]) {
        modelsToUse = [locMap[location.toUpperCase()]];
      }
    }

    const horseMap = {};
    for (let i = 1; i <= 12; i++) {
      horseMap[i] = { horse: i, entries: 0, wins: 0, places: 0, lastWin: null, pos1: 0, pos2: 0, pos3: 0, pos4: 0 };
    }

    let allRacesRaw = [];
    for (const Model of modelsToUse) {
      const races = await Model.find({}, { runners: 1, createdAt: 1, date: 1, gameId: 1, gameNumber: 1 }).lean();
      allRacesRaw = allRacesRaw.concat(races);
    }

    const uniqueRacesMap = new Map();
    allRacesRaw.forEach(r => {
      const id = r.gameId || `${r.gameNumber}_${r.date || r.createdAt}`;
      if (!uniqueRacesMap.has(id)) uniqueRacesMap.set(id, r);
    });

    const allRaces = Array.from(uniqueRacesMap.values());
    const totalRaces = allRaces.length;

    allRaces.forEach(race => {
      if (!race.runners || race.runners.length === 0) return;
      race.runners.forEach(({ horseNo, position }) => {
        if (!horseMap[horseNo]) return;
        const h = horseMap[horseNo];
        h.entries++;
        if (position === 1) {
          h.wins++; h.pos1++;
          const raceDate = race.date || race.createdAt;
          h.lastWin = !h.lastWin || raceDate > h.lastWin ? raceDate : h.lastWin;
        }
        if (position === 2) h.pos2++;
        if (position === 3) h.pos3++;
        if (position === 4) h.pos4++;
        if (position <= 3) h.places++;
      });
    });

    const horseStats = Object.values(horseMap);
    const topHorses = horseStats
      .filter((h) => h.entries > 0)
      .sort((a, b) => b.wins / b.entries - a.wins / a.entries)
      .slice(0, 8)
      .map((h) => ({
        horse: `Horse ${h.horse}`,
        winRate: h.entries ? Number(((h.wins / h.entries) * 100).toFixed(2)) : 0,
        totalWins: h.wins, totalEntries: h.entries,
        placeRate: h.entries ? Number(((h.places / h.entries) * 100).toFixed(2)) : 0,
      }));

    const positionStats = { 1: 0, 2: 0, 3: 0, 4: 0 };
    horseStats.forEach((h) => {
      positionStats[1] += h.pos1; positionStats[2] += h.pos2;
      positionStats[3] += h.pos3; positionStats[4] += h.pos4;
    });

    const winRateRanges = {
      "High Performer (20%+)": 0, "Good Performer (10-20%)": 0,
      "Average (5-10%)": 0, "Low Performer (<5%)": 0,
    };

    horseStats.forEach((h) => {
      if (h.entries === 0) return;
      const winRate = (h.wins / h.entries) * 100;
      if (winRate >= 20) winRateRanges["High Performer (20%+)"]++;
      else if (winRate >= 10) winRateRanges["Good Performer (10-20%)"]++;
      else if (winRate >= 5) winRateRanges["Average (5-10%)"]++;
      else winRateRanges["Low Performer (<5%)"]++;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trendData = await Promise.all(
      modelsToUse.map(async (model) => {
        return await model.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, races: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]);
      })
    );

    const mergedTrend = {};
    trendData.flat().forEach((item) => {
      if (!mergedTrend[item._id]) mergedTrend[item._id] = 0;
      mergedTrend[item._id] += item.races;
    });

    const raceTrend = Object.entries(mergedTrend)
      .map(([date, races]) => ({ date, races }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalPositions = totalRaces * 4;
    const activeHorsesCount = horseStats.filter((h) => h.entries > 0).length;
    const avgWinRate = activeHorsesCount > 0
      ? (horseStats.filter(h => h.entries > 0).reduce((sum, h) => sum + (h.wins / h.entries) * 100, 0) / activeHorsesCount).toFixed(1)
      : "0.0";

    res.json({
      success: true,
      location: location.toUpperCase(),
      graphData: {
        topHorsesChart: { type: "bar", title: "Top 8 Horse Win Rates", data: topHorses, xAxis: "horse", yAxis: "winRate" },
        positionDistribution: {
          type: "pie", title: "Overall Position Distribution",
          data: Object.entries(positionStats).map(([position, count]) => ({
            name: `${position}${position === "1" ? "st" : position === "2" ? "nd" : position === "3" ? "rd" : "th"} Place`,
            value: count, percentage: totalPositions > 0 ? ((count / totalPositions) * 100).toFixed(1) : "0",
          })),
        },
        winRateDistribution: {
          type: "pie", title: "Horse Performance Distribution",
          data: Object.entries(winRateRanges).map(([range, count]) => ({ name: range, value: count, percentage: ((count / 12) * 100).toFixed(1) })),
        },
        raceTrendChart: { type: "line", title: "Daily Race Frequency (Last 30 Days)", data: raceTrend, xAxis: "date", yAxis: "races" },
        summaryCards: [
          { title: "Total Races", value: totalRaces, icon: "horse", color: "brown" },
          { title: "Active Horses", value: activeHorsesCount, icon: "users", color: "blue" },
          { title: "Avg Win Rate", value: `${avgWinRate}%`, icon: "trophy", color: "gold" },
        ],
      },
      metadata: { totalRaces, totalHorses: 12, lastUpdated: new Date().toISOString() },
    });
  } catch (err) {
    console.error("Trackside graph stats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
