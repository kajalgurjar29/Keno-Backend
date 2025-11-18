import _ from "lodash";
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

export const getOverdueCombos = async (req, res) => {
  try {
    const { location = "NSW", size = 4 } = req.query;
    const Model = allCollections[location];

    if (!Model) return res.status(400).json({ message: "Invalid location" });

    const draws = await Model.find().sort({ drawNumber: 1 });
    if (draws.length === 0)
      return res.status(404).json({ message: "No draw data found" });

    // Convert draw numbers into arrays of combos of given size
    let comboStats = new Map();

    for (let i = 0; i < draws.length; i++) {
      const numbers = draws[i].numbers;

      // Generate all combinations of the given size
      const combos = getCombinations(numbers, Number(size));

      combos.forEach((combo) => {
        const key = combo.join("-");
        if (!comboStats.has(key)) {
          comboStats.set(key, { count: 0, lastSeen: i });
        }
        comboStats.get(key).count += 1;
        comboStats.get(key).lastSeen = i;
      });
    }

    // Calculate overdue score
    const results = Array.from(comboStats.entries()).map(([combo, stat]) => {
      const avgEvery = draws.length / stat.count;
      const overdue = draws.length - stat.lastSeen;
      return {
        combo,
        avgEvery: Math.round(avgEvery),
        lastSeen: overdue,
        frequency: stat.count,
      };
    });

    // Sort by overdue ratio
    const sorted = _.orderBy(results, ["lastSeen"], ["desc"]).slice(0, 20);

    res.status(200).json(sorted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Helper function for combinations
function getCombinations(arr, size) {
  const result = [];
  function helper(start, combo) {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return result;
}

export const getOverdueCombospagination = async (req, res) => {
  try {
    const { location = "NSW", size = 4, page = 1, limit = 4 } = req.query;

    const Model = allCollections[location];
    if (!Model) return res.status(400).json({ message: "Invalid location" });

    const draws = await Model.find().sort({ drawNumber: 1 });
    if (draws.length === 0)
      return res.status(404).json({ message: "No draw data found" });

    // Map to store combination stats
    let comboStats = new Map();

    // Loop through all draw results
    for (let i = 0; i < draws.length; i++) {
      const numbers = draws[i].numbers;
      const combos = getCombinations(numbers, Number(size));

      combos.forEach((combo) => {
        const key = combo.join("-");
        if (!comboStats.has(key)) {
          comboStats.set(key, { count: 0, lastSeen: i });
        }
        comboStats.get(key).count += 1;
        comboStats.get(key).lastSeen = i;
      });
    }

    // Calculate overdue metrics
    const results = Array.from(comboStats.entries()).map(([combo, stat]) => {
      const avgEvery = draws.length / stat.count;
      const overdue = draws.length - stat.lastSeen;
      return {
        combo,
        avgEvery: Math.round(avgEvery),
        lastSeen: overdue,
        frequency: stat.count,
      };
    });

    // Sort by overdue order (most overdue first)
    const sorted = _.orderBy(results, ["lastSeen"], ["desc"]);

    // Pagination logic
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const startIndex = (pageNumber - 1) * pageSize;
    const paginatedData = sorted.slice(startIndex, startIndex + pageSize);

    res.status(200).json({
      success: true,
      totalCombos: sorted.length,
      currentPage: pageNumber,
      totalPages: Math.ceil(sorted.length / pageSize),
      limit: pageSize,
      data: paginatedData,
    });
  } catch (error) {
    console.error("Error in getOverdueCombos:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
