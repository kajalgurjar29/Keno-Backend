import NSW from "../../models/NSWkenoDrawResult.model.js";
import VIC from "../../models/VICkenoDrawResult.model.js";
import ACT from "../../models/ACTkenoDrawResult.model.js";
import SA from "../../models/SAkenoDrawResult.model.js";

const MODELS = [NSW, VIC, ACT, SA];


export const getCombinedKenoQuickStats = async (req, res) => {
  try {
    const data = await TrackSideResult.aggregate([
      { $unwind: "$runners" },

      {
        $group: {
          _id: "$runners.horseNo",

          entries: { $sum: 1 },

          win: {
            $sum: {
              $cond: [{ $eq: ["$runners.position", 1] }, 1, 0]
            }
          },

          place: {
            $sum: {
              $cond: [{ $lte: ["$runners.position", 3] }, 1, 0]
            }
          },

          lastWin: {
            $max: {
              $cond: [
                { $eq: ["$runners.position", 1] },
                "$raceDate",
                null
              ]
            }
          }
        }
      },

      {
        $addFields: {
          winPercentage: {
            $round: [
              {
                $cond: [
                  { $gt: ["$entries", 0] },
                  { $multiply: [{ $divide: ["$win", "$entries"] }, 100] },
                  0
                ]
              },
              2
            ]
          },
          totalRaces: "$entries"
        }
      },

      {
        $project: {
          _id: 0,
          horseNo: "$_id",
          entries: 1,
          win: 1,
          place: 1,
          winPercentage: 1,
          lastWin: 1,
          totalRaces: 1
        }
      },

      { $sort: { horseNo: 1 } }
    ]);

    res.json({ success: true, data });
  } catch (err) {
    console.error("Horse quick stats error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

