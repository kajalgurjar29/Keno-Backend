import ACTDrawNumber from "../../models/ACTkenoDrawResult.model.js";
import NSWDrawNumber from "../../models/NSWkenoDrawResult.model.js";
import SADrawNumber from "../../models/SAkenoDrawResult.model.js";
import VICDrawNumber from "../../models/VICkenoDrawResult.model.js";
import _ from "lodash";

const allCollections = [
  { location: "ACT", model: ACTDrawNumber },
  { location: "NSW", model: NSWDrawNumber },
  { location: "SA", model: SADrawNumber },
  { location: "VIC", model: VICDrawNumber },
];

export const generateExoticPredictions = async (req, res) => {
  try {
    const {
      betType = "Quinella",
      minRacesSinceLastOccurrence = 50,
      noOfCombinations = 2,
      location = "ALL",
    } = req.body;

    // Fetch all location data (or one if selected)
    const dataPromises =
      location === "ALL"
        ? allCollections.map((col) => col.model.find().lean())
        : [
            allCollections
              .find((c) => c.location === location)
              .model.find()
              .lean(),
          ];

    const allData = (await Promise.all(dataPromises)).flat();

    if (!allData.length) {
      return res.status(404).json({ success: false, message: "No data found" });
    }

    // Sort newest first
    allData.sort((a, b) => new Date(b.date) - new Date(a.date));

    const combos = generateFilteredCombinations(
      allData,
      betType,
      parseInt(minRacesSinceLastOccurrence),
      parseInt(noOfCombinations)
    );

    res.json({ success: true, data: combos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ======= Core Combination Logic =======
function generateFilteredCombinations(data, betType, minRaces, comboCount) {
  const recentData = data.slice(0, minRaces);
  const allNumbers = _.uniq(data.flatMap((d) => d.numbers));

  // Determine combo size based on bet type
  const comboSize =
    betType === "Trifecta" ? 3 : betType === "First Four" ? 4 : 2;

  const allCombos = generateCombinations(allNumbers, comboSize, betType);

  // Filter out combos that appeared recently
  const recentCombos = new Set(
    recentData.flatMap((d) =>
      generateCombinations(d.numbers, comboSize, betType).map((c) =>
        c.join("-")
      )
    )
  );

  const filtered = allCombos.filter((c) => !recentCombos.has(c.join("-")));

  // Random sample
  return _.sampleSize(filtered, comboCount);
}

function generateCombinations(numbers, size, betType) {
  const results = [];

  const helper = (combo, remaining) => {
    if (combo.length === size) {
      results.push([...combo]);
      return;
    }

    for (let i = 0; i < remaining.length; i++) {
      helper([...combo, remaining[i]], remaining.slice(i + 1));
    }
  };

  helper([], numbers);

  // For ordered bets (Trifecta, First Four)
  if (betType !== "Quinella") {
    return results.flatMap((c) => permute(c));
  }

  return results;
}

function permute(arr) {
  if (arr.length <= 1) return [arr];
  const res = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = permute(rest);
    for (const p of perms) res.push([arr[i], ...p]);
  }
  return res;
}

