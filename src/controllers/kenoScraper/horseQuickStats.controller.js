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
