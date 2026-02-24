import NSWTrackSideResult from "../../models/TrackSideResult.NSW.model.js";
import NSWKenoResult from "../../models/NSWkenoDrawResult.model.js";
import VICKenoResult from "../../models/VICkenoDrawResult.model.js";
import ACTKenoResult from "../../models/ACTkenoDrawResult.model.js";
import SAKenoResult from "../../models/SAkenoDrawResult.model.js";
import axios from "axios";

const kenoModels = {
  NSW: NSWKenoResult,
  VIC: VICKenoResult,
  ACT: ACTKenoResult,
  SA: SAKenoResult,
};
const kdsConfig = {
  NSW: "https://api-info-nsw.keno.com.au/v2/games/kds?jurisdiction=NSW",
  VIC: "https://api-info-vic.keno.com.au/v2/games/kds?jurisdiction=VIC",
  ACT: "https://api-info-act.keno.com.au/v2/games/kds?jurisdiction=ACT",
  SA: "https://api-info-sa.keno.com.au/v2/games/kds?jurisdiction=SA",
};
const MAX_DRAW_AHEAD = 0;

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
  const value = String(location || "").trim().toUpperCase();
  return kenoModels[value] ? value : null;
};

// keno.com.au "SA" live draw stream aligns with ACT draw feed.
const resolveLiveJurisdiction = (location) => {
  const normalized = normalizeLocation(location);
  return normalized === "SA" ? "ACT" : normalized;
};

const drawNumFromValue = (value) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

const fetchLiveDrawCeiling = async (location) => {
  const endpoint = kdsConfig[resolveLiveJurisdiction(location)];
  if (!endpoint) return null;
  try {
    const { data } = await axios.get(endpoint, { timeout: 10000, proxy: false });
    return drawNumFromValue(data?.current?.["game-number"]);
  } catch {
    return null;
  }
};

const getLatestKenoRecord = async (location) => {
  const normalized = normalizeLocation(location);

  if (normalized) {
    const sourceLocation = resolveLiveJurisdiction(normalized);
    const ceiling = await fetchLiveDrawCeiling(sourceLocation);
    const pipeline = [
      { $match: validNumbersFilter },
      {
        $addFields: {
          drawNum: {
            $convert: {
              input: "$draw",
              to: "int",
              onError: -1,
              onNull: -1,
            },
          },
        },
      },
    ];

    if (Number.isInteger(ceiling)) {
      pipeline.push({
        $match: { drawNum: { $lte: ceiling + MAX_DRAW_AHEAD } },
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1, drawNum: -1 } },
      { $limit: 1 },
      { $project: { drawNum: 0 } },
    );

    const [latest] = await kenoModels[sourceLocation].aggregate(pipeline);
    return latest || null;
  }

  const latestByState = await Promise.all(
    Object.entries(kenoModels).map(async ([loc, Model]) => {
      const ceiling = await fetchLiveDrawCeiling(loc);
      const pipeline = [
        { $match: validNumbersFilter },
        {
          $addFields: {
            drawNum: {
              $convert: {
                input: "$draw",
                to: "int",
                onError: -1,
                onNull: -1,
              },
            },
          },
        },
      ];

      if (Number.isInteger(ceiling)) {
        pipeline.push({
          $match: { drawNum: { $lte: ceiling + MAX_DRAW_AHEAD } },
        });
      }

      pipeline.push(
        { $sort: { createdAt: -1, drawNum: -1 } },
        { $limit: 1 },
        { $project: { drawNum: 0 } },
      );

      const rows = await Model.aggregate(pipeline);
      return rows[0] || null;
    }),
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
    // Make default behavior deterministic for clients that do not pass `location`.
    // This avoids cross-jurisdiction draw mismatches (e.g. ACT vs SA draw numbers).
    const requestedLocation = normalizeLocation(req.query.location) || "NSW";
    const sourceLocation = resolveLiveJurisdiction(requestedLocation);
    const keno = await getLatestKenoRecord(requestedLocation);

    const kenoData = keno
      ? {
          draw: keno.draw,
          date: keno.date,
          numbers: keno.numbers,
          location: requestedLocation,
          upstreamJurisdiction: sourceLocation,
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
