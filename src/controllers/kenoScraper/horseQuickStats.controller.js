import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";

const MODELS = [NSW, VIC, ACT];

export const getTrackSideQuickStats = async (req, res) => {
  try {
    let totalRaces = 0;
    const horseMap = {};

    // init horses 1–12
    for (let i = 1; i <= 12; i++) {
      horseMap[i] = {
        entries: 0,
        win: 0,
        place: 0,
        lastWin: null,
        pos1: 0,
        pos2: 0,
        pos3: 0,
        pos4: 0
      };
    }

    for (const Model of MODELS) {
      const races = await Model.countDocuments({});
      totalRaces += races;

      const results = await Model.aggregate([
        { $match: { runners: { $exists: true, $ne: [] } } },
        { $unwind: "$runners" },
        {
          $project: {
            horseNo: "$runners.horseNo",
            position: "$runners.position",
            raceDate: "$createdAt"
          }
        }
      ]);

      results.forEach((r) => {
        const h = horseMap[r.horseNo];
        if (!h) return;

        h.entries++;

        if (r.position === 1) {
          h.win++;
          h.lastWin = !h.lastWin || r.raceDate > h.lastWin
            ? r.raceDate
            : h.lastWin;
          h.pos1++;
        }
        if (r.position === 2) h.pos2++;
        if (r.position === 3) h.pos3++;
        if (r.position === 4) h.pos4++;
        if (r.position <= 3) h.place++;
      });
    }

    const response = Object.keys(horseMap).map((horseNo) => {
      const h = horseMap[horseNo];

      return {
        horse: Number(horseNo),
        summary: {
          entries: h.entries,
          win: h.win,
          place: h.place,
          winPercentage: h.entries
            ? Number(((h.win / h.entries) * 100).toFixed(2))
            : 0,
          lastWin: h.lastWin,
          totalRaces
        },
        positions: {
          "1st": { avg: h.pos1 ? Math.round(totalRaces / h.pos1) : null },
          "2nd": { avg: h.pos2 ? Math.round(totalRaces / h.pos2) : null },
          "3rd": { avg: h.pos3 ? Math.round(totalRaces / h.pos3) : null },
          "4th": { avg: h.pos4 ? Math.round(totalRaces / h.pos4) : null }
        }
      };
    });

    res.json({ success: true, data: response });
  } catch (err) {
    console.error("TrackSide QuickStats Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
