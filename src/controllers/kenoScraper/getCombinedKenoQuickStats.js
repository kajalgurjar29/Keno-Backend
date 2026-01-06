import NSW from "../../models/NSWkenoDrawResult.model.js";
import VIC from "../../models/VICkenoDrawResult.model.js";
import ACT from "../../models/ACTkenoDrawResult.model.js";
import SA from "../../models/SAkenoDrawResult.model.js";

const MODELS = [NSW, VIC, ACT, SA];

export const getCombinedKenoQuickStats = async (req, res) => {
  try {
    const pipeline = [
      { $unwind: "$numbers" },

      {
        $group: {
          _id: "$numbers",
          frequency: { $sum: 1 },
          lastDraw: { $max: "$drawDate" }
        }
      },

      {
        $project: {
          _id: 0,
          number: "$_id",
          frequency: 1,
          lastDraw: 1
        }
      },

      { $sort: { number: 1 } }
    ];

    // 🔥 Run aggregate on all KENO models
    const results = await Promise.all(
      MODELS.map((model) => model.aggregate(pipeline))
    );

    // 🔥 Merge all state results
    const merged = results.flat();

    // 🔥 Total draws count
    const totalDraws = await Promise.all(
      MODELS.map((model) => model.countDocuments())
    );

    res.json({
      success: true,
      totalDraws: totalDraws.reduce((a, b) => a + b, 0),
      numbers: merged
    });

  } catch (err) {
    console.error("Keno quick stats error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
