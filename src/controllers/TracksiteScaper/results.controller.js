import NSWTrackSideResult from "../../models/TrackSideResult.NSW.model.js";
import NSWKenoResult from "../../models/NSWkenoDrawResult.model.js";
import VICKenoResult from "../../models/VICkenoDrawResult.model.js";
import ACTKenoResult from "../../models/ACTkenoDrawResult.model.js";
import SAKenoResult from "../../models/SAkenoDrawResult.model.js";

const kenoModels = {
  NSW: NSWKenoResult,
  VIC: VICKenoResult,
  ACT: ACTKenoResult,
  SA: SAKenoResult,
};

const validNumbersFilter = {
  numbers: { $size: 20 },
  $expr: {
    $eq: [
      { $size: "$numbers" },
      { $size: { $setUnion: ["$numbers", []] } },
    ],
  },
};

const normalizeLocation = (location) => {
  const value = String(location || "").toUpperCase();
  return kenoModels[value] ? value : null;
};

const getLatestKenoRecord = async (location) => {
  const normalized = normalizeLocation(location);

  if (normalized) {
    return kenoModels[normalized]
      .findOne(validNumbersFilter)
      .sort({ createdAt: -1 })
      .lean();
  }

  const latestByState = await Promise.all(
    Object.values(kenoModels).map((Model) =>
      Model.findOne(validNumbersFilter).sort({ createdAt: -1 }).lean()
    )
  );

  return latestByState
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
};

export const getLatestTrackSideResult = async (req, res) => {
  try {
    const result = await NSWTrackSideResult.findOne()
      .sort({ createdAt: -1 })
      .lean();

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No TrackSide results found",
      });
    }

    const sortedRunners = (result.runners || [])
      .filter(r => r.position)
      .sort((a, b) => a.position - b.position);

    const win = sortedRunners.find(r => r.position === 1) || null;
    const place = sortedRunners.filter(r =>
      [1, 2, 3].includes(r.position)
    );

    const exacta =
      sortedRunners.length >= 2
        ? [sortedRunners[0].horseNo, sortedRunners[1].horseNo]
        : [];

    const trifecta =
      sortedRunners.length >= 3
        ? [
            sortedRunners[0].horseNo,
            sortedRunners[1].horseNo,
            sortedRunners[2].horseNo,
          ]
        : [];

    res.status(200).json({
      success: true,
      data: {
        gameId: result.gameId,
        gameName: result.gameName,
        drawNumber: result.drawNumber,
        gameNumber: result.gameNumber,
        location: result.location,
        date: result.date,
        numbers: result.numbers,

        results: {
          win,
          place,
          exacta,
          trifecta,
        },

        runners: sortedRunners,
      },
    });
  } catch (error) {
    console.error("Results API Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getLatestResults = async (req, res) => {
  try {
    /* ================= TRACKSIDE ================= */
    const trackSide = await NSWTrackSideResult.findOne()
      .sort({ createdAt: -1 })
      .lean();

    let trackSideData = null;

    if (trackSide) {
      const sortedRunners = (trackSide.runners || [])
        .filter(r => r.position)
        .sort((a, b) => a.position - b.position);

      trackSideData = {
        gameId: trackSide.gameId,
        gameName: trackSide.gameName,
        drawNumber: trackSide.drawNumber,
        gameNumber: trackSide.gameNumber,
        location: trackSide.location,
        date: trackSide.date,
        numbers: trackSide.numbers,

        results: {
          win: sortedRunners.find(r => r.position === 1) || null,
          place: sortedRunners.filter(r =>
            [1, 2, 3].includes(r.position)
          ),
          exacta:
            sortedRunners.length >= 2
              ? [sortedRunners[0].horseNo, sortedRunners[1].horseNo]
              : [],
          trifecta:
            sortedRunners.length >= 3
              ? [
                  sortedRunners[0].horseNo,
                  sortedRunners[1].horseNo,
                  sortedRunners[2].horseNo,
                ]
              : [],
        },

        runners: sortedRunners,
      };
    }

    /* ================= KENO ================= */
    const keno = await getLatestKenoRecord(req.query.location);

    const kenoData = keno
      ? {
          draw: keno.draw,
          date: keno.date,
          numbers: keno.numbers,
          location: keno.location,
          heads: keno.heads,
          tails: keno.tails,
          result: keno.result,
          bonus: keno.bonus || "REG",
        }
      : null;

    /* ================= RESPONSE ================= */
    res.status(200).json({
      success: true,
      data: {
        trackSide: trackSideData,
        keno: kenoData,
      },
    });
  } catch (error) {
    console.error("Latest Results API Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
