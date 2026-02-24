import ACTDrawNumber from "../../models/ACTkenoDrawResult.model.js";
import NSWDrawNumber from "../../models/NSWkenoDrawResult.model.js";
import SADrawNumber from "../../models/SAkenoDrawResult.model.js";
import VICDrawNumber from "../../models/VICkenoDrawResult.model.js";

const allCollections = {
  ACT: ACTDrawNumber,
  NSW: NSWDrawNumber,
  SA: SADrawNumber,
  VIC: VICDrawNumber,
};

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseDateToDayNumber = (value) => {
  if (!value) return null;

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / 86400000;
  }

  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    return Date.UTC(y, m - 1, d) / 86400000;
  }

  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    return Date.UTC(y, m - 1, d) / 86400000;
  }

  const ts = Date.parse(raw);
  if (Number.isFinite(ts)) {
    const dt = new Date(ts);
    return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) / 86400000;
  }

  return null;
};

const compareNullableNumbers = (a, b) => {
  if (a !== null && b !== null && a !== b) return a - b;
  if (a !== null && b === null) return -1;
  if (a === null && b !== null) return 1;
  return 0;
};

const compareKenoDraws = (a, b) => {
  const dayA = parseDateToDayNumber(a.date ?? a.createdAt);
  const dayB = parseDateToDayNumber(b.date ?? b.createdAt);
  const dayDiff = compareNullableNumbers(dayA, dayB);
  if (dayDiff !== 0) return dayDiff;

  const drawA = toFiniteNumber(a.draw ?? a.drawNumber);
  const drawB = toFiniteNumber(b.draw ?? b.drawNumber);
  const drawDiff = compareNullableNumbers(drawA, drawB);
  if (drawDiff !== 0) return drawDiff;

  const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : null;
  const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : null;
  const createdAtDiff = compareNullableNumbers(createdAtA, createdAtB);
  if (createdAtDiff !== 0) return createdAtDiff;

  return String(a._id || "").localeCompare(String(b._id || ""));
};

// Analyze the historical frequency for an exact combination (order-insensitive)
// Body:
// {
//   "location": "NSW" | "ACT" | "SA" | "VIC" | "ALL",
//   "entries": [7, 12, 8, 10],  // exact numbers to match (order-insensitive)
//   "size": 4                    // length of the combo
// }

export const analyzeHistoricalFrequency = async (req, res) => {
  try {
    const { location = "NSW", entries = [], size } = req.body || {};

    if (!Array.isArray(entries) || entries.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "entries must be a non-empty array" });
    }

    const comboSize = Number(size || entries.length);
    if (comboSize !== entries.length) {
      return res.status(400).json({
        success: false,
        message: "size must equal entries length",
      });
    }

    const normalizedTarget = [...entries].map(Number).sort((a, b) => a - b);

    const modelsToScan =
      location === "ALL"
        ? Object.values(allCollections)
        : [allCollections[location]];

    if (modelsToScan.includes(undefined)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid location" });
    }

    const allDrawsArrays = (
      await Promise.all(
        modelsToScan.map((m) =>
          m
            .find({}, { numbers: 1, draw: 1, drawNumber: 1, createdAt: 1, date: 1 })
            .lean(),
        ),
      )
    ).flat();

    // Sort by game order (date + draw) to avoid createdAt backfill skew.
    allDrawsArrays.sort(compareKenoDraws);

    if (!allDrawsArrays.length) {
      return res
        .status(404)
        .json({ success: false, message: "No draw data found" });
    }

    // Metrics
    let occurrences = 0;
    let lastSeenIndex = -1;
    let lastDrawNumber = null;
    const occurrenceIndexes = [];

    for (let i = 0; i < allDrawsArrays.length; i++) {
      const draw = allDrawsArrays[i];
      const numbers = Array.isArray(draw.numbers) ? draw.numbers : [];
      if (numbers.length === 0) continue;

      // Fast check: target must be subset of draw numbers
      const hasAll = normalizedTarget.every((n) => numbers.includes(n));
      if (!hasAll) continue;

      // If all numbers are included in the draw, we count it as an occurrence
      occurrences += 1;
      lastSeenIndex = i;
      lastDrawNumber = draw.draw ?? draw.drawNumber ?? null;
      occurrenceIndexes.push(i);
    }

    const totalDraws = allDrawsArrays.length;
    const lastOccurrenceRacesAgo =
      lastSeenIndex === -1
        ? totalDraws
        : Math.max(0, totalDraws - 1 - lastSeenIndex);

    // Average interval between occurrences (drought)
    let averageInterval = 0;
    if (occurrenceIndexes.length > 1) {
      let sum = 0;
      for (let i = 1; i < occurrenceIndexes.length; i++) {
        // Drought is missed draws between two hits.
        sum += Math.max(0, occurrenceIndexes[i] - occurrenceIndexes[i - 1] - 1);
      }
      averageInterval = Math.round(sum / (occurrenceIndexes.length - 1));
    }

    const avgEvery = occurrences > 0 ? Math.round(totalDraws / occurrences) : 0;
    const winningPct =
      occurrences > 0 ? Math.round((occurrences / totalDraws) * 100) : 0;
    const safeLastDrawNumber = lastDrawNumber ?? 0;

    return res.status(200).json({
      success: true,
      data: {
        combination: normalizedTarget.join("-"),
        size: comboSize,
        totalDraws,
        occurrences,
        avgEvery, // average every N races
        lastOccurrenceRacesAgo, // how many races ago it last occurred
        averageInterval, // average drought length between occurrences
        winningPercentage: winningPct,
        lastDrawNumber: safeLastDrawNumber,
        appeared: occurrences > 0,
      },
    });
  } catch (error) {
    console.error("analyzeHistoricalFrequency error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export default analyzeHistoricalFrequency;
