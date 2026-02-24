import _ from "lodash";
import ACTDrawNumber from "../../models/ACTkenoDrawResult.model.js";
import NSWDrawNumber from "../../models/NSWkenoDrawResult.model.js";
import SADrawNumber from "../../models/SAkenoDrawResult.model.js";
import VICDrawNumber from "../../models/VICkenoDrawResult.model.js";
// OverdueCombo model import removed as we are no longer persisting to DB

const allCollections = {
  ACT: ACTDrawNumber,
  NSW: NSWDrawNumber,
  SA: SADrawNumber,
  VIC: VICDrawNumber,
};

// Helper for 10-digit numeric ID (deterministic without crypto)
const generateNumericId = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 10000000000;
  }
  return hash;
};

// Worker function to generate stats in-memory
const calculateStats = async (location, size, maxDraws) => {
  const Model = allCollections[location];
  if (!Model) throw new Error("Invalid location");

  let draws = await Model.find().sort({ drawNumber: 1 });
  if (draws.length === 0) return { drawsCount: 0, results: [] };

  // Limit processing to maxDraws to ensure speed
  const max = Number(maxDraws) || 500;
  if (draws.length > max) draws = draws.slice(draws.length - max);

  const drawsCount = draws.length;
  let comboStats = new Map();

  // Process all draws
  for (let i = 0; i < draws.length; i++) {
    let numbers = draws[i].numbers;
    if (!numbers || numbers.length === 0) continue;

    // Sort numbers to ensure ID is consistent for the same combination
    const sortedNumbers = [...numbers].sort((a, b) => a - b);

    processCombinations(sortedNumbers, Number(size), (combo) => {
      const key = combo.join("-");
      if (!comboStats.has(key)) {
        comboStats.set(key, { count: 0, lastSeen: i });
      }
      const stat = comboStats.get(key);
      stat.count += 1;
      stat.lastSeen = i;
    });
  }

  // Transform to result array
  const results = Array.from(comboStats.entries()).map(([comboKey, stat]) => {
    const avgEvery = drawsCount / stat.count;
    const overdue = Math.max(0, drawsCount - stat.lastSeen - 1);
    const comboArr = comboKey.split("-").map(Number);

    // Create a 10-digit numeric ID
    const numericId = generateNumericId(`${location}_KENO_${size}_${comboKey}`);

    return {
      _id: numericId,
      id: numericId,
      location,
      size: Number(size),
      combo: comboArr,
      comboKey,
      avgEvery: Math.round(avgEvery),
      lastSeen: overdue,
      frequency: stat.count,
      drawsCount,
      generatedAt: new Date(),
      updatedAt: new Date(),
    };
  });

  return { drawsCount, results };
};

export const getOverdueCombos = async (req, res) => {
  try {
    const { location = "NSW", size = 4, maxDraws = 500 } = req.query;

    const { results } = await calculateStats(location, size, maxDraws);

    if (results.length === 0) {
      return res.status(404).json({ message: "No draw data found" });
    }

    const sorted = _.orderBy(results, ["lastSeen"], ["desc"]).slice(0, 20);
    return res.status(200).json(sorted);
  } catch (error) {
    console.error("Error in getOverdueCombos:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getOverdueCombospagination = async (req, res) => {
  try {
    const {
      location = "NSW",
      size = 4,
      page = 1,
      limit = 10,
      maxDraws = 200,
    } = req.query;

    const { results } = await calculateStats(location, size, maxDraws);

    if (results.length === 0) {
      return res.status(404).json({ message: "No draw data found" });
    }

    const sorted = _.orderBy(results, ["lastSeen"], ["desc"]);

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const startIndex = (pageNumber - 1) * pageSize;
    const paginatedData = sorted.slice(startIndex, startIndex + pageSize);

    return res.status(200).json({
      success: true,
      totalCombos: sorted.length,
      currentPage: pageNumber,
      totalPages: Math.ceil(sorted.length / pageSize),
      limit: pageSize,
      data: paginatedData,
    });
  } catch (error) {
    console.error("Error in getOverdueCombospagination:", error);
    res.status(500).json({ message: error.message });
  }
};

function processCombinations(arr, size, cb) {
  const combo = [];
  function helper(start) {
    if (combo.length === size) {
      cb([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1);
      combo.pop();
    }
  }
  helper(0);
}
