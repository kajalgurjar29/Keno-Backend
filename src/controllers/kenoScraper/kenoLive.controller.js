import axios from "axios";
import NSWKeno from "../../models/NSWkenoDrawResult.model.js";
import VICKeno from "../../models/VICkenoDrawResult.model.js";
import ACTKeno from "../../models/ACTkenoDrawResult.model.js";
import SAKeno from "../../models/SAkenoDrawResult.model.js";

const normalizeLocation = (location) => {
  switch (String(location || "NSW").toUpperCase()) {
    case "VIC":
    case "ACT":
    case "SA":
    case "NSW":
      return String(location).toUpperCase();
    default:
      return "NSW";
  }
};

const getModel = (location) => {
  switch (normalizeLocation(location)) {
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

const validNumbersFilter = {
  numbers: { $size: 20 },
  $expr: {
    $eq: [
      { $size: "$numbers" },
      { $size: { $setUnion: ["$numbers", []] } },
    ],
  },
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
  const endpoint = kdsConfig[normalizedLocation];
  if (!endpoint) return null;

  const { data } = await axios.get(endpoint, { timeout: 10000 });
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

    // 1) Prefer real-time KDS API for true live data
    try {
      const liveData = await fetchLiveKenoFromApi(location);
      if (liveData) {
        return res.status(200).json({
          label: `Keno ${location}`,
          draw: liveData.draw,
          date: liveData.date,
          numbers: liveData.numbers,
          location: liveData.location,
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

    const result = await Model.findOne(validNumbersFilter)
      .sort({ createdAt: -1 });

    if (!result) {
      return res.status(404).json({
        message: `No ${location || "NSW"} keno result available`,
      });
    }

    res.status(200).json({
      label: `Keno ${result.location || location}`,
      draw: result.draw,
      date: result.date,
      numbers: result.numbers,
      location: result.location || location,
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

    const results = await Model.find(validNumbersFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

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

    const results = await Model.find(validNumbersFilter)
      .sort({ createdAt: -1 })
      .limit(limit);

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
