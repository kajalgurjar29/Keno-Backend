import axios from "axios";
import NSWKeno from "../../models/NSWkenoDrawResult.model.js";
import VICKeno from "../../models/VICkenoDrawResult.model.js";
import ACTKeno from "../../models/ACTkenoDrawResult.model.js";
import SAKeno from "../../models/SAkenoDrawResult.model.js";

const normalizeLocation = (location) => {
  const normalized = String(location || "NSW").trim().toUpperCase();
  switch (normalized) {
    case "VIC":
    case "ACT":
    case "SA":
    case "NSW":
      return normalized;
    default:
      return "NSW";
  }
};

// keno.com.au "SA" live draw stream aligns with ACT draw feed.
const resolveLiveJurisdiction = (location) => {
  const normalized = normalizeLocation(location);
  return normalized === "SA" ? "ACT" : normalized;
};

const getModel = (location) => {
  switch (resolveLiveJurisdiction(location)) {
    case "VIC": return VICKeno;
    case "ACT": return ACTKeno;
    case "SA": return SAKeno;
    default: return NSWKeno;
  }
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

const drawNumFromValue = (value) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

const fetchLiveDrawCeiling = async (location) => {
  const jurisdiction = resolveLiveJurisdiction(location);
  const endpoint = kdsConfig[jurisdiction];
  if (!endpoint) return null;
  try {
    const { data } = await axios.get(endpoint, { timeout: 10000, proxy: false });
    return drawNumFromValue(data?.current?.["game-number"]);
  } catch {
    return null;
  }
};

const getLatestByDraw = async (Model, location, knownCeiling = null) => {
  const ceiling = Number.isInteger(knownCeiling)
    ? knownCeiling
    : await fetchLiveDrawCeiling(location);

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

  const [latest] = await Model.aggregate(pipeline);
  return latest || null;
};

const parseLiveResultLabel = (label, heads, tails) => {
  const value = String(label || "").toLowerCase();
  if (value.includes("heads")) return "Heads wins";
  if (value.includes("tails")) return "Tails wins";
  if (value.includes("evens")) return "Evens wins";
  if (heads > tails) return "Heads wins";
  if (tails > heads) return "Tails wins";
  return "Evens wins";
};

const fetchLiveKenoFromApi = async (location) => {
  const normalizedLocation = normalizeLocation(location);
  const jurisdiction = resolveLiveJurisdiction(normalizedLocation);
  const endpoint = kdsConfig[jurisdiction];
  if (!endpoint) return null;

  const { data } = await axios.get(endpoint, { timeout: 10000, proxy: false });
  const current = data?.current;
  const rawDraw = current?.["game-number"];
  const rawNumbers = Array.isArray(current?.draw) ? current.draw : [];

  if (!rawDraw || rawNumbers.length === 0) {
    return null;
  }

  const numbers = rawNumbers
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 80)
    .sort((a, b) => a - b);

  const heads = numbers.filter((n) => n <= 40).length;
  const tails = numbers.length - heads;
  const bonus = String(current?.variants?.bonus || "REG");

  return {
    draw: String(rawDraw),
    date: new Date().toISOString(),
    numbers,
    location: normalizedLocation,
    upstreamJurisdiction: jurisdiction,
    heads,
    tails,
    result: parseLiveResultLabel(current?.variants?.["heads-or-tails"]?.result, heads, tails),
    bonus,
    isLive: numbers.length < 20,
    source: "live-api",
  };
};

export const getLiveKenoResult = async (req, res) => {
  try {
    const location = normalizeLocation(req.query.location);
    let liveDrawCeiling = null;

    // 1) Prefer real-time KDS API for true live data
    try {
      const liveData = await fetchLiveKenoFromApi(location);
      if (liveData) {
        liveDrawCeiling = drawNumFromValue(liveData.draw);
        return res.status(200).json({
          label: `Keno ${location}`,
          draw: liveData.draw,
          date: liveData.date,
          numbers: liveData.numbers,
          location: liveData.location,
          upstreamJurisdiction: liveData.upstreamJurisdiction,
          heads: liveData.heads,
          tails: liveData.tails,
          result: liveData.result,
          bonus: liveData.bonus,
          isLive: liveData.isLive,
          source: liveData.source,
        });
      }
    } catch (liveErr) {
      console.warn(`⚠️ Live KDS fetch failed for ${location}:`, liveErr.message);
    }

    // 2) Fallback to latest completed DB record
    const Model = getModel(location);

    const result = await getLatestByDraw(Model, location, liveDrawCeiling);

    if (!result) {
      return res.status(404).json({
        message: `No ${location || "NSW"} keno result available`,
      });
    }

    res.status(200).json({
      label: `Keno ${location}`,
      draw: result.draw,
      date: result.date,
      numbers: result.numbers,
      location,
      upstreamJurisdiction: resolveLiveJurisdiction(location),
      heads: result.heads,
      tails: result.tails,
      result: result.result,
      bonus: result.bonus || "REG",
      isLive: false,
      source: "database",
    });
  } catch (err) {
    console.error("❌ getLiveKenoResult error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const getKenoDrawHistory = async (req, res) => {
  try {
    const location = normalizeLocation(req.query.location);
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const Model = getModel(location);
    const liveDrawCeiling = await fetchLiveDrawCeiling(location);

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

    if (Number.isInteger(liveDrawCeiling)) {
      pipeline.push({
        $match: { drawNum: { $lte: liveDrawCeiling + MAX_DRAW_AHEAD } },
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1, drawNum: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { drawNum: 0 } },
    );

    const results = await Model.aggregate(pipeline);

    const formattedData = results.map((item) => ({
      race: `#${item.draw}`,
      time: item.date,
      number: item.numbers.join("-"),
      status: "Completed",
    }));

    res.status(200).json({
      success: true,
      page,
      limit,
      data: formattedData,
    });
  } catch (err) {
    console.error("❌ getKenoDrawHistory error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch draw history",
    });
  }
};

export const getKenoHeadsTailsHistory = async (req, res) => {
  try {
    const location = normalizeLocation(req.query.location);
    const limit = parseInt(req.query.limit) || 20;
    const Model = getModel(location);
    const liveDrawCeiling = await fetchLiveDrawCeiling(location);

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

    if (Number.isInteger(liveDrawCeiling)) {
      pipeline.push({
        $match: { drawNum: { $lte: liveDrawCeiling + MAX_DRAW_AHEAD } },
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1, drawNum: -1 } },
      { $limit: limit },
      { $project: { drawNum: 0 } },
    );

    const results = await Model.aggregate(pipeline);

    const tableData = results.map((item) => ({
      draw: item.draw,
      date: item.date,
      winner: item.result || (item.heads > item.tails ? "Heads wins" : item.tails > item.heads ? "Tails wins" : "Evens wins"),
      headsCount: item.heads,
      tailsCount: item.tails,
      bonus: item.bonus || "REG",
      numbers: item.numbers
    }));

    res.status(200).json({
      success: true,
      data: tableData,
    });
  } catch (err) {
    console.error("❌ getKenoHeadsTailsHistory error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
