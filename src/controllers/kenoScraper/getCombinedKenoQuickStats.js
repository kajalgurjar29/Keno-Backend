import NSW from "../../models/NSWkenoDrawResult.model.js";
import VIC from "../../models/VICkenoDrawResult.model.js";
import ACT from "../../models/ACTkenoDrawResult.model.js";
import SA from "../../models/SAkenoDrawResult.model.js";

const MODELS = [NSW, VIC, ACT, SA];

export const getCombinedKenoQuickStats = async (req, res) => {
  try {
    const pipeline = [
      {
        $project: {
          drawDate: 1,
          numbers: 1,
        },
      },

      // Each number in the draw
      { $unwind: "$numbers" },

      {
        $group: {
          _id: "$numbers",
          entries: { $sum: 1 },
          lastSeen: { $max: "$drawDate" },
        },
      },

      {
        $project: {
          _id: 0,
          number: "$_id",
          entries: 1,
          lastSeen: 1,
        },
      },

      { $sort: { number: 1 } },
    ];

    // Run aggregation on all state collections
    const results = await Promise.all(
      MODELS.map((model) => model.aggregate(pipeline))
    );

    // Merge stats across states
    const statsMap = new Map();

    results.flat().forEach((item) => {
      if (!statsMap.has(item.number)) {
        statsMap.set(item.number, item);
      } else {
        const prev = statsMap.get(item.number);
        statsMap.set(item.number, {
          number: item.number,
          entries: prev.entries + item.entries,
          lastSeen:
            prev.lastSeen > item.lastSeen ? prev.lastSeen : item.lastSeen,
        });
      }
    });

    // Total draws (for percentage)
    const totalDrawsPerState = await Promise.all(
      MODELS.map((model) => model.countDocuments())
    );
    const totalDraws = totalDrawsPerState.reduce((a, b) => a + b, 0);

    // Final response
    const finalStats = Array.from(statsMap.values()).map((item) => ({
      number: item.number,
      entries: item.entries,
      winPercent: totalDraws
        ? ((item.entries / totalDraws) * 100).toFixed(2)
        : "0.00",
      lastSeen: item.lastSeen,
      totalRaces: totalDraws,
    }));

    // Aggregation for Heads/Tails/Evens counts
    const headsTailsPipeline = [
      {
        $group: {
          _id: "$result",
          count: { $sum: 1 },
        },
      },
    ];

    const headsTailsResults = await Promise.all(
      MODELS.map((model) => model.aggregate(headsTailsPipeline))
    );

    const headsTailsSummary = {
      "Heads wins": 0,
      "Tails wins": 0,
      Evens: 0,
    };

    headsTailsResults.flat().forEach((item) => {
      if (item._id && headsTailsSummary[item._id] !== undefined) {
        headsTailsSummary[item._id] += item.count;
      }
    });

    res.json({
      success: true,
      totalRaces: totalDraws,
      stats: finalStats,
      headsTailsStats: {
        headsWins: headsTailsSummary["Heads wins"],
        tailsWins: headsTailsSummary["Tails wins"],
        evens: headsTailsSummary["Evens"],
        headsWinsPercent: totalDraws ? ((headsTailsSummary["Heads wins"] / totalDraws) * 100).toFixed(2) : "0.00",
        tailsWinsPercent: totalDraws ? ((headsTailsSummary["Tails wins"] / totalDraws) * 100).toFixed(2) : "0.00",
        evensPercent: totalDraws ? ((headsTailsSummary["Evens"] / totalDraws) * 100).toFixed(2) : "0.00",
      },
    });
  } catch (err) {
    console.error("Keno quick stats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Graph-ready Keno Quick Stats
export const getKenoGraphStats = async (req, res) => {
  try {
    const pipeline = [
      {
        $project: {
          drawDate: 1,
          numbers: 1,
        },
      },
      { $unwind: "$numbers" },
      {
        $group: {
          _id: "$numbers",
          entries: { $sum: 1 },
          lastSeen: { $max: "$drawDate" },
        },
      },
      {
        $project: {
          _id: 0,
          number: "$_id",
          entries: 1,
          lastSeen: 1,
        },
      },
      { $sort: { entries: -1 } },
    ];

    const results = await Promise.all(
      MODELS.map((model) => model.aggregate(pipeline))
    );

    const statsMap = new Map();
    results.flat().forEach((item) => {
      if (!statsMap.has(item.number)) {
        statsMap.set(item.number, item);
      } else {
        const prev = statsMap.get(item.number);
        statsMap.set(item.number, {
          number: item.number,
          entries: prev.entries + item.entries,
          lastSeen:
            prev.lastSeen > item.lastSeen ? prev.lastSeen : item.lastSeen,
        });
      }
    });

    const totalDrawsPerState = await Promise.all(
      MODELS.map((model) => model.countDocuments())
    );
    const totalDraws = totalDrawsPerState.reduce((a, b) => a + b, 0);

    const allStats = Array.from(statsMap.values());

    // Top 20 hot numbers for bar chart
    const hotNumbers = allStats
      .sort((a, b) => b.entries - a.entries)
      .slice(0, 20)
      .map((item) => ({
        number: item.number,
        frequency: item.entries,
        percentage: ((item.entries / totalDraws) * 100).toFixed(2),
      }));

    // Number distribution for pie chart (frequency ranges)
    const frequencyRanges = {
      "Very Hot (15%+)": 0,
      "Hot (10-15%)": 0,
      "Warm (5-10%)": 0,
      "Cold (1-5%)": 0,
      "Very Cold (<1%)": 0,
    };

    allStats.forEach((item) => {
      const percentage = (item.entries / totalDraws) * 100;
      if (percentage >= 15) frequencyRanges["Very Hot (15%+)"]++;
      else if (percentage >= 10) frequencyRanges["Hot (10-15%)"]++;
      else if (percentage >= 5) frequencyRanges["Warm (5-10%)"]++;
      else if (percentage >= 1) frequencyRanges["Cold (1-5%)"]++;
      else frequencyRanges["Very Cold (<1%)"]++;
    });

    // Recent trend data (last 30 days)
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
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]);
      })
    );

    const mergedTrend = {};
    trendData.flat().forEach((item) => {
      if (!mergedTrend[item._id]) mergedTrend[item._id] = 0;
      mergedTrend[item._id] += item.count;
    });

    const drawTrend = Object.entries(mergedTrend)
      .map(([date, count]) => ({ date, draws: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Graph-ready response
    res.json({
      success: true,
      graphData: {
        // Bar chart: Top hot numbers
        hotNumbersChart: {
          type: "bar",
          title: "Top 20 Hot Numbers",
          data: hotNumbers,
          xAxis: "number",
          yAxis: "frequency",
        },

        // Pie chart: Number frequency distribution
        frequencyDistribution: {
          type: "pie",
          title: "Number Frequency Distribution",
          data: Object.entries(frequencyRanges).map(([range, count]) => ({
            name: range,
            value: count,
            percentage: ((count / 80) * 100).toFixed(1), // 80 numbers total
          })),
        },

        // Line chart: Draw frequency over time
        drawTrendChart: {
          type: "line",
          title: "Daily Draw Frequency (Last 30 Days)",
          data: drawTrend,
          xAxis: "date",
          yAxis: "draws",
        },

        // Pie chart: Heads/Tails/Evens distribution
        headsTailsDistribution: {
          type: "pie",
          title: "Heads, Tails & Evens Distribution",
          data: await (async () => {
            const headsTailsResults = await Promise.all(
              MODELS.map((model) =>
                model.aggregate([
                  { $group: { _id: "$result", count: { $sum: 1 } } },
                ])
              )
            );
            const summary = { "Heads wins": 0, "Tails wins": 0, Evens: 0 };
            headsTailsResults.flat().forEach((item) => {
              if (item._id && summary[item._id] !== undefined)
                summary[item._id] += item.count;
            });
            return Object.entries(summary).map(([name, value]) => ({
              name,
              value,
              percentage: totalDraws ? ((value / totalDraws) * 100).toFixed(1) : "0",
            }));
          })(),
        },

        // Summary cards
        summaryCards: [
          {
            title: "Total Draws",
            value: totalDraws,
            icon: "gamepad",
            color: "blue",
          },
          {
            title: "Hot Numbers",
            value: hotNumbers.length,
            icon: "fire",
            color: "red",
          },
          {
            title: "Avg Frequency",
            value: (totalDraws / 80).toFixed(0),
            icon: "chart-line",
            color: "green",
          },
        ],
      },
      metadata: {
        totalDraws,
        totalNumbers: 80,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Keno graph stats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
