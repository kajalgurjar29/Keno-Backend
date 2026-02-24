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
            .find({}, { numbers: 1, drawNumber: 1, createdAt: 1, date: 1 })
            .lean()
        )
      )
    ).flat();

    // Ensure combined ALL-location analytics are processed in a single stable order.
    allDrawsArrays.sort((a, b) => {
      const aTs = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
      const bTs = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
      const aHasTs = Number.isFinite(aTs);
      const bHasTs = Number.isFinite(bTs);

      if (aHasTs && bHasTs && aTs !== bTs) return aTs - bTs;
      if (aHasTs && !bHasTs) return -1;
      if (!aHasTs && bHasTs) return 1;

      const aDraw = Number(a.drawNumber);
      const bDraw = Number(b.drawNumber);
      const aHasDraw = Number.isFinite(aDraw);
      const bHasDraw = Number.isFinite(bDraw);

      if (aHasDraw && bHasDraw && aDraw !== bDraw) return aDraw - bDraw;
      if (aHasDraw && !bHasDraw) return -1;
      if (!aHasDraw && bHasDraw) return 1;
      return 0;
    });

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
      lastDrawNumber = draw.drawNumber ?? null;
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
