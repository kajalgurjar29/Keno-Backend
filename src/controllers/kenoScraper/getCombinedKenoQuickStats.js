import NSW from "../../models/NSWkenoDrawResult.model.js";
import VIC from "../../models/VICkenoDrawResult.model.js";
import ACT from "../../models/ACTkenoDrawResult.model.js";
import SA from "../../models/SAkenoDrawResult.model.js";

const MODELS = [NSW, VIC, ACT, SA];

export const getCombinedKenoQuickStats = async (req, res) => {
  try {
    const { location = "ALL" } = req.query;
    let modelsToUse = MODELS;

    if (location !== "ALL") {
      const locMap = { "NSW": NSW, "VIC": VIC, "ACT": ACT, "SA": SA };
      if (locMap[location.toUpperCase()]) {
        modelsToUse = [locMap[location.toUpperCase()]];
      }
    }

    const pipeline = [
      { $match: { numbers: { $size: 20 } } },
      {
        $project: {
          createdAt: 1,
          numbers: 1,
        },
      },
      { $unwind: "$numbers" },
      {
        $group: {
          _id: "$numbers",
          entries: { $sum: 1 },
          lastSeen: { $max: "$createdAt" },
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

    const results = await Promise.all(
      modelsToUse.map((model) => model.aggregate(pipeline))
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
      modelsToUse.map((model) => model.countDocuments({ numbers: { $size: 20 } }))
    );
    const totalDraws = totalDrawsPerState.reduce((a, b) => a + b, 0);

    const sortedByDrought = Array.from(statsMap.values()).sort((a, b) => {
      if (!a.lastSeen && !b.lastSeen) return 0;
      if (!a.lastSeen) return -1;
      if (!b.lastSeen) return 1;
      return new Date(a.lastSeen) - new Date(b.lastSeen);
    }).slice(0, 10);

    const finalStats = await Promise.all(sortedByDrought.map(async (item) => {
      const formattedDate = item.lastSeen ? new Date(item.lastSeen).toLocaleDateString('en-AU') : "-";
      const winPercent = totalDraws ? parseFloat(((item.entries / totalDraws) * 100).toFixed(2)) : 0;

      let drought = 0;
      if (item.lastSeen) {
        const droughtCounts = await Promise.all(modelsToUse.map(model =>
          model.countDocuments({
            createdAt: { $gt: item.lastSeen },
            numbers: { $size: 20 }
          })
        ));
        drought = droughtCounts.reduce((a, b) => a + b, 0);
      } else {
        drought = totalDraws;
      }

      let status = "Normal";
      let isHot = false;
      let isCold = false;
      let recommended = false;

      if (winPercent >= 26) { status = "Very Hot"; isHot = true; recommended = true; }
      else if (winPercent >= 25.5) { status = "Hot"; isHot = true; }
      else if (winPercent <= 24) { status = "Very Cold"; isCold = true; recommended = true; }
      else if (winPercent <= 24.5) { status = "Cold"; isCold = true; }

      return {
        number: item.number,
        entries: item.entries,
        winPercent: winPercent.toFixed(2),
        status,
        isHot,
        isCold,
        recommended,
        lastSeen: formattedDate,
        lastWin: drought,
        drought,
        totalRaces: totalDraws,
      };
    }));

    const headsTailsPipeline = [
      { $match: { numbers: { $size: 20 } } },
      { $project: { numbers: 1, result: 1, heads: 1, tails: 1 } },
    ];

    const headsTailsResults = await Promise.all(
      modelsToUse.map((model) => model.aggregate(headsTailsPipeline))
    );

    const headsTailsSummary = { "Heads wins": 0, "Tails wins": 0, "Evens wins": 0 };

    headsTailsResults.flat().forEach((item) => {
      let result = item.result;
      const isInvalid = !result || !["Heads wins", "Tails wins", "Evens wins"].includes(result);

      if (isInvalid && item.numbers && item.numbers.length === 20) {
        const hCount = item.numbers.filter(n => n >= 1 && n <= 40).length;
        const tCount = item.numbers.filter(n => n >= 41 && n <= 80).length;
        if (hCount > tCount) result = "Heads wins";
        else if (tCount > hCount) result = "Tails wins";
        else result = "Evens wins";
      }

      if (headsTailsSummary[result] !== undefined) {
        headsTailsSummary[result]++;
      }
    });

    res.json({
      success: true,
      totalRaces: totalDraws,
      location: location.toUpperCase(),
      stats: finalStats,
      headsTailsStats: {
        headsWins: headsTailsSummary["Heads wins"],
        tailsWins: headsTailsSummary["Tails wins"],
        evensWins: headsTailsSummary["Evens wins"],
        headsWinsPercent: totalDraws ? ((headsTailsSummary["Heads wins"] / totalDraws) * 100).toFixed(2) : "0.00",
        tailsWinsPercent: totalDraws ? ((headsTailsSummary["Tails wins"] / totalDraws) * 100).toFixed(2) : "0.00",
        evensWinsPercent: totalDraws ? ((headsTailsSummary["Evens wins"] / totalDraws) * 100).toFixed(2) : "0.00",
      },
    });
  } catch (err) {
    console.error("Keno quick stats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getKenoGraphStats = async (req, res) => {
  try {
    const { location = "ALL" } = req.query;
    let modelsToUse = MODELS;

    if (location !== "ALL") {
      const locMap = { "NSW": NSW, "VIC": VIC, "ACT": ACT, "SA": SA };
      if (locMap[location.toUpperCase()]) {
        modelsToUse = [locMap[location.toUpperCase()]];
      }
    }

    const pipeline = [
      { $match: { numbers: { $size: 20 } } },
      { $project: { createdAt: 1, numbers: 1 } },
      { $unwind: "$numbers" },
      {
        $group: {
          _id: "$numbers",
          entries: { $sum: 1 },
          lastSeen: { $max: "$createdAt" },
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
      modelsToUse.map((model) => model.aggregate(pipeline))
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
      modelsToUse.map((model) => model.countDocuments({ numbers: { $size: 20 } }))
    );
    const totalDraws = totalDrawsPerState.reduce((a, b) => a + b, 0);

    const allStatsEnriched = Array.from(statsMap.values()).map((item) => {
      const winPercent = totalDraws ? (item.entries / totalDraws) * 100 : 0;
      const lastSeenDate = new Date(item.lastSeen);
      const now = new Date();
      const droughtDays = Math.floor((now - lastSeenDate) / (1000 * 60 * 60 * 24));

      let status = "Normal";
      if (winPercent >= 26) status = "Very Hot";
      else if (winPercent >= 25.5) status = "Hot";
      else if (winPercent <= 24) status = "Very Cold";
      else if (winPercent <= 24.5) status = "Cold";

      return { ...item, winPercent, status, droughtDays };
    });

    const hotNumbers = [...allStatsEnriched]
      .sort((a, b) => b.entries - a.entries)
      .slice(0, 20)
      .map((item) => ({
        number: item.number,
        frequency: item.entries,
        percentage: item.winPercent.toFixed(2),
        status: item.status
      }));

    const coldNumbers = [...allStatsEnriched]
      .sort((a, b) => a.entries - b.entries)
      .slice(0, 20)
      .map((item) => ({
        number: item.number,
        frequency: item.entries,
        percentage: item.winPercent.toFixed(2),
        status: item.status,
        isOverdue: item.droughtDays > 0
      }));

    const frequencyRanges = {
      "Very Hot (26%+)": 0,
      "Hot (25.5-26%)": 0,
      "Normal (24.5-25.5%)": 0,
      "Cold (24-24.5%)": 0,
      "Very Cold (<24%)": 0,
    };

    allStatsEnriched.forEach((item) => {
      const percentage = item.winPercent;
      if (percentage >= 26) frequencyRanges["Very Hot (26%+)"]++;
      else if (percentage >= 25.5) frequencyRanges["Hot (25.5-26%)"]++;
      else if (percentage >= 24.5) frequencyRanges["Normal (24.5-25.5%)"]++;
      else if (percentage >= 24) frequencyRanges["Cold (24-24.5%)"]++;
      else frequencyRanges["Very Cold (<24%)"]++;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trendData = await Promise.all(
      modelsToUse.map(async (model) => {
        return await model.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo }, numbers: { $size: 20 } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
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

    // Shared logic for Heads/Tails/Evens
    const headsTailsResults = await Promise.all(
      modelsToUse.map((model) =>
        model.aggregate([
          { $match: { numbers: { $size: 20 } } },
          { $project: { result: 1, numbers: 1 } },
        ])
      )
    );
    const summaryHT = { "Heads wins": 0, "Tails wins": 0, "Evens wins": 0 };
    headsTailsResults.flat().forEach((item) => {
      let res = item.result;
      const isInvalid = !res || !["Heads wins", "Tails wins", "Evens wins"].includes(res);
      if (isInvalid && item.numbers && item.numbers.length === 20) {
        const hCount = item.numbers.filter(n => n >= 1 && n <= 40).length;
        const tCount = item.numbers.filter(n => n >= 41 && n <= 80).length;
        if (hCount > tCount) res = "Heads wins";
        else if (tCount > hCount) res = "Tails wins";
        else res = "Evens wins";
      }
      if (summaryHT[res] !== undefined) summaryHT[res]++;
    });

    res.json({
      success: true,
      location: location.toUpperCase(),
      graphData: {
        hotNumbersChart: { type: "bar", title: "Top 20 Hot Numbers", data: hotNumbers, xAxis: "number", yAxis: "frequency" },
        coldNumbersChart: { type: "bar", title: "Top 20 Cold/Overdue Numbers", data: coldNumbers, xAxis: "number", yAxis: "frequency" },
        frequencyDistribution: {
          type: "pie", title: "Number Frequency Distribution",
          data: Object.entries(frequencyRanges).map(([range, count]) => ({ name: range, value: count, percentage: ((count / 80) * 100).toFixed(1) }))
        },
        drawTrendChart: { type: "line", title: "Daily Draw Frequency (Last 30 Days)", data: drawTrend, xAxis: "date", yAxis: "draws" },
        headsTailsDistribution: {
          type: "pie", title: "Heads, Tails & Evens Distribution",
          data: Object.entries(summaryHT).map(([name, value]) => ({ name, value, percentage: totalDraws ? ((value / totalDraws) * 100).toFixed(1) : "0" }))
        },
        summaryCards: [
          { title: "Total Draws", value: totalDraws, icon: "gamepad", color: "blue" },
          { title: "Max Hits", value: hotNumbers.length > 0 ? hotNumbers[0].frequency : 0, icon: "fire", color: "red" },
          { title: "Avg Frequency", value: (totalDraws * 0.25).toFixed(0), icon: "chart-line", color: "green" },
        ],
      },
      metadata: { totalDraws, totalNumbers: 80, lastUpdated: new Date().toISOString() },
    });
  } catch (err) {
    console.error("Keno graph stats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
