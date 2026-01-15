import _ from "lodash";
import ACTDrawNumber from "../../models/ACTkenoDrawResult.model.js";
import NSWDrawNumber from "../../models/NSWkenoDrawResult.model.js";
import SADrawNumber from "../../models/SAkenoDrawResult.model.js";
import VICDrawNumber from "../../models/VICkenoDrawResult.model.js";
import OverdueCombo from "../../models/OverdueCombo.model.js";

const allCollections = {
  ACT: ACTDrawNumber,
  NSW: NSWDrawNumber,
  SA: SADrawNumber,
  VIC: VICDrawNumber,
};

export const getOverdueCombos = async (req, res) => {
  try {
    const { location = "NSW", size = 4, maxDraws = 500 } = req.query;
    const Model = allCollections[location];

    if (!Model) return res.status(400).json({ message: "Invalid location" });

    let draws = await Model.find().sort({ drawNumber: 1 });
    if (draws.length === 0)
      return res.status(404).json({ message: "No draw data found" });

    // Limit number of draws processed to avoid OOM
    const max = Number(maxDraws) || 500;
    if (draws.length > max) draws = draws.slice(draws.length - max);

    // Convert draw numbers into arrays of combos of given size (streamed)
    let comboStats = new Map();

    for (let i = 0; i < draws.length; i++) {
      const numbers = draws[i].numbers;
      processCombinations(numbers, Number(size), (combo) => {
        const key = combo.join("-");
        if (!comboStats.has(key)) {
          comboStats.set(key, { count: 0, lastSeen: i });
        }
        const stat = comboStats.get(key);
        stat.count += 1;
        stat.lastSeen = i;
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

    // Persist generated combos to DB (upsert) in batches to avoid OOM
    try {
      const bulkOps = sorted.map((item) => {
        const comboKey = item.combo;
        const comboArr = comboKey.split("-").map((n) => Number(n));
        return {
          updateOne: {
            filter: {
              location: location,
              size: Number(size),
              comboKey: comboKey,
            },
            update: {
              $set: {
                location: location,
                size: Number(size),
                combo: comboArr,
                comboKey: comboKey,
                avgEvery: item.avgEvery,
                lastSeen: item.lastSeen,
                frequency: item.frequency,
                drawsCount: draws.length,
                generatedAt: new Date(),
                updatedAt: new Date(),
              },
            },
            upsert: true,
          },
        };
      });

      if (bulkOps.length > 0)
        await bulkWriteInBatches(OverdueCombo, bulkOps, 500);

      // Return stored documents (with _id and full fields)
      const docs = await OverdueCombo.find({
        location: location,
        size: Number(size),
      })
        .sort({ lastSeen: -1 })
        .limit(20)
        .lean();

      return res.status(200).json(docs);
    } catch (dbErr) {
      console.error("Error saving or fetching OverdueCombos:", dbErr);
      // Fallback to returning computed results if DB fails
      return res.status(200).json(sorted);
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    const payload = {
      message: "Server error",
      error: error && error.message ? error.message : String(error),
    };
    if (process.env.NODE_ENV !== "production")
      payload.stack = error && error.stack ? error.stack : null;
    res.status(500).json(payload);
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
    const {
      location = "NSW",
      size = 4,
      page = 1,
      limit = 4,
      maxDraws = 200,
    } = req.query;

    const Model = allCollections[location];
    if (!Model) return res.status(400).json({ message: "Invalid location" });

    let draws = await Model.find().sort({ drawNumber: 1 });
    if (draws.length === 0)
      return res.status(404).json({ message: "No draw data found" });

    // Limit processed draws and stream combinations to avoid OOM
    const max = Number(maxDraws) || 200;
    if (draws.length > max) draws = draws.slice(draws.length - max);

    // Map to store combination stats
    let comboStats = new Map();

    // Loop through all draw results
    for (let i = 0; i < draws.length; i++) {
      const numbers = draws[i].numbers;
      processCombinations(numbers, Number(size), (combo) => {
        const key = combo.join("-");
        if (!comboStats.has(key)) {
          comboStats.set(key, { count: 0, lastSeen: i });
        }
        const stat = comboStats.get(key);
        stat.count += 1;
        stat.lastSeen = i;
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

    // Persist (upsert) computed combos in batches; then return paginated DB results
    try {
      const bulkOps = sorted.map((item) => {
        const comboKey = item.combo;
        const comboArr = comboKey.split("-").map((n) => Number(n));
        return {
          updateOne: {
            filter: {
              location: location,
              size: Number(size),
              comboKey: comboKey,
            },
            update: {
              $set: {
                location: location,
                size: Number(size),
                combo: comboArr,
                comboKey: comboKey,
                avgEvery: item.avgEvery,
                lastSeen: item.lastSeen,
                frequency: item.frequency,
                drawsCount: draws.length,
                generatedAt: new Date(),
                updatedAt: new Date(),
              },
            },
            upsert: true,
          },
        };
      });

      if (bulkOps.length > 0)
        await bulkWriteInBatches(OverdueCombo, bulkOps, 500);

      // Pagination logic using DB
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
      const skipCount = (pageNumber - 1) * pageSize;

      const totalCombos = await OverdueCombo.countDocuments({
        location: location,
        size: Number(size),
      });
      const docs = await OverdueCombo.find({
        location: location,
        size: Number(size),
      })
        .sort({ lastSeen: -1 })
        .skip(skipCount)
        .limit(pageSize)
        .lean();

      return res.status(200).json({
        success: true,
        totalCombos,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCombos / pageSize),
        limit: pageSize,
        data: docs,
      });
    } catch (dbErr) {
      console.error(
        "Error persisting/fetching paginated OverdueCombos:",
        dbErr
      );
      // Fallback to returning computed paginated data
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
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    const payload = {
      message: "Server error",
      error: error && error.message ? error.message : String(error),
    };
    if (process.env.NODE_ENV !== "production")
      payload.stack = error && error.stack ? error.stack : null;
    res.status(500).json(payload);
  }
};

// Stream combinations without building an array
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

// Bulk write in batches to limit memory usage
async function bulkWriteInBatches(model, ops, batchSize = 500) {
  for (let i = 0; i < ops.length; i += batchSize) {
    const chunk = ops.slice(i, i + batchSize);
    if (chunk.length > 0) await model.bulkWrite(chunk);
  }
}
