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

    res.json({
      success: true,
      totalRaces: totalDraws,
      stats: finalStats,
    });
  } catch (err) {
    console.error("Keno quick stats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
