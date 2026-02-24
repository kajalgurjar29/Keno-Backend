import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";

const MODELS = [NSW, VIC, ACT];

export const getTrackSideQuickStats = async (req, res) => {
  try {
    const horseMap = {};
    let totalRaces = 0;

    // Initialize horses 1–12
    for (let i = 1; i <= 12; i++) {
      horseMap[i] = {
        horse: i,
        entries: 0,
        wins: 0,
        places: 0,
        lastWin: null,
        pos1: 0,
        pos2: 0,
        pos3: 0,
        pos4: 0,
      };
    }

    for (const Model of MODELS) {
      totalRaces += await Model.countDocuments({});

      const results = await Model.aggregate([
        { $match: { runners: { $exists: true, $ne: [] } } },
        { $unwind: "$runners" },
        {
          $project: {
            horseNo: "$runners.horseNo",
            position: "$runners.position",
            raceDate: "$createdAt",
          },
        },
      ]);

      results.forEach(({ horseNo, position, raceDate }) => {
        if (!horseMap[horseNo]) return;

        const h = horseMap[horseNo];
        h.entries++;

        if (position === 1) {
          h.wins++;
          h.pos1++;
          h.lastWin = !h.lastWin || raceDate > h.lastWin ? raceDate : h.lastWin;
        }

        if (position === 2) h.pos2++;
        if (position === 3) h.pos3++;
        if (position === 4) h.pos4++;

        if (position <= 3) h.places++;
      });
    }

    // Final response formatting
    const response = Object.values(horseMap).map((h) => ({
      horse: h.horse,
      summary: {
        entries: h.entries,
        wins: h.wins,
        places: h.places,
        winPercentage: h.entries
          ? Number(((h.wins / h.entries) * 100).toFixed(2))
          : 0,
        lastWin: h.lastWin,
        totalRaces,
      },
      positions: {
        "1st": h.pos1,
        "2nd": h.pos2,
        "3rd": h.pos3,
        "4th": h.pos4,
      },
    }));

    res.json({
      success: true,
      totalRaces,
      data: response,
    });
  } catch (err) {
    console.error("TrackSide QuickStats Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Graph-ready Trackside Quick Stats
export const getTracksideGraphStats = async (req, res) => {
  try {
    const horseMap = {};
    let totalRaces = 0;

    // Initialize horses 1–12
    for (let i = 1; i <= 12; i++) {
      horseMap[i] = {
        horse: i,
        entries: 0,
        wins: 0,
        places: 0,
        lastWin: null,
        pos1: 0,
        pos2: 0,
        pos3: 0,
        pos4: 0,
      };
    }

    for (const Model of MODELS) {
      totalRaces += await Model.countDocuments({});

      const results = await Model.aggregate([
        { $match: { runners: { $exists: true, $ne: [] } } },
        { $unwind: "$runners" },
        {
          $project: {
            horseNo: "$runners.horseNo",
            position: "$runners.position",
            raceDate: "$createdAt",
          },
        },
      ]);

      results.forEach(({ horseNo, position, raceDate }) => {
        if (!horseMap[horseNo]) return;

        const h = horseMap[horseNo];
        h.entries++;

        if (position === 1) {
          h.wins++;
          h.pos1++;
          h.lastWin = !h.lastWin || raceDate > h.lastWin ? raceDate : h.lastWin;
        }

        if (position === 2) h.pos2++;
        if (position === 3) h.pos3++;
        if (position === 4) h.pos4++;

        if (position <= 3) h.places++;
      });
    }

    const horseStats = Object.values(horseMap);

    // Top performing horses for bar chart
    const topHorses = horseStats
      .filter((h) => h.entries > 0)
      .sort((a, b) => b.wins / b.entries - a.wins / a.entries)
      .slice(0, 8)
      .map((h) => ({
        horse: `Horse ${h.horse}`,
        winRate: h.entries
          ? Number(((h.wins / h.entries) * 100).toFixed(2))
          : 0,
        totalWins: h.wins,
        totalEntries: h.entries,
        placeRate: h.entries
          ? Number(((h.places / h.entries) * 100).toFixed(2))
          : 0,
      }));

    // Position distribution for all horses
    const positionStats = { 1: 0, 2: 0, 3: 0, 4: 0 };
    horseStats.forEach((h) => {
      positionStats[1] += h.pos1;
      positionStats[2] += h.pos2;
      positionStats[3] += h.pos3;
      positionStats[4] += h.pos4;
    });

    // Win rate distribution
    const winRateRanges = {
      "High Performer (20%+)": 0,
      "Good Performer (10-20%)": 0,
      "Average (5-10%)": 0,
      "Low Performer (<5%)": 0,
    };

    horseStats.forEach((h) => {
      if (h.entries === 0) return;
      const winRate = (h.wins / h.entries) * 100;
      if (winRate >= 20) winRateRanges["High Performer (20%+)"]++;
      else if (winRate >= 10) winRateRanges["Good Performer (10-20%)"]++;
      else if (winRate >= 5) winRateRanges["Average (5-10%)"]++;
      else winRateRanges["Low Performer (<5%)"]++;
    });

    // Recent performance trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trendData = await Promise.all(
      MODELS.map(async (model) => {
        return await model.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              races: { $sum: 1 },
            },
          },
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
    const activeHorses = horseStats.filter((h) => h.entries > 0);
    const avgWinRate =
      activeHorses.length > 0
        ? (
            activeHorses.reduce((sum, h) => sum + (h.wins / h.entries) * 100, 0) /
            activeHorses.length
          ).toFixed(1)
        : "0.0";

    // Graph-ready response
    res.json({
      success: true,
      graphData: {
        // Bar chart: Top horse win rates
        topHorsesChart: {
          type: "bar",
          title: "Top 8 Horse Win Rates",
          data: topHorses,
          xAxis: "horse",
          yAxis: "winRate",
        },

        // Pie chart: Position distribution
        positionDistribution: {
          type: "pie",
          title: "Overall Position Distribution",
          data: Object.entries(positionStats).map(([position, count]) => ({
            name: `${position}${
              position === "1"
                ? "st"
                : position === "2"
                ? "nd"
                : position === "3"
                ? "rd"
                : "th"
            } Place`,
            value: count,
            percentage:
              totalPositions > 0
                ? ((count / totalPositions) * 100).toFixed(1)
                : "0",
          })),
        },

        // Pie chart: Win rate distribution
        winRateDistribution: {
          type: "pie",
          title: "Horse Performance Distribution",
          data: Object.entries(winRateRanges).map(([range, count]) => ({
            name: range,
            value: count,
            percentage: ((count / 12) * 100).toFixed(1), // 12 horses total
          })),
        },

        // Line chart: Race frequency over time
        raceTrendChart: {
          type: "line",
          title: "Daily Race Frequency (Last 30 Days)",
          data: raceTrend,
          xAxis: "date",
          yAxis: "races",
        },

        // Summary cards
        summaryCards: [
          {
            title: "Total Races",
            value: totalRaces,
            icon: "horse",
            color: "brown",
          },
          {
            title: "Active Horses",
            value: horseStats.filter((h) => h.entries > 0).length,
            icon: "users",
            color: "blue",
          },
          {
            title: "Avg Win Rate",
            value: `${avgWinRate}%`,
            icon: "trophy",
            color: "gold",
          },
        ],
      },
      metadata: {
        totalRaces,
        totalHorses: 12,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Trackside graph stats error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
