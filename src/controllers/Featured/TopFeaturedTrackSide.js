import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";

const MODELS = [NSW, VIC, ACT];

/* =========================================================
   HELPERS
========================================================= */

const getValidSortedRunners = (runners = []) => {
  console.log("➡ Raw runners:", runners);

  const valid = runners.filter(r => r.horseNo && r.horseNo !== 0);
  console.log(" Valid runners:", valid);

  const sorted = valid.sort((a, b) => a.position - b.position);
  console.log(" Sorted runners:", sorted);

  return sorted;
};

const buildResponse = (map, totalRaces, order = "top") => {
  console.log(" Combination map:", map);
  console.log("🏁 Total races:", totalRaces);

  const expectedLength = {
    Quinella: 2,
    Trifecta: 3,
    "First Four": 4
  };

  const format = (type) => {
    console.log(`\n Formatting ${type}`);

    return Object.entries(map[type])
      .filter(([combo]) => {
        const ok = combo.split("-").length === expectedLength[type];
        if (!ok) console.log(" Invalid combo:", combo);
        return ok;
      })
      .sort((a, b) =>
        order === "least"
          ? a[1].count - b[1].count
          : b[1].count - a[1].count
      )
      .slice(0, 3)
      .map(([combo, val]) => {
        console.log("✔ Final combo:", combo, val);

        return {
          entries: combo.split("-").map(Number),
          winPercentage: Number(
            ((val.count / totalRaces) * 100).toFixed(1)
          ),
          avg: Math.round(totalRaces / val.count),
          lastAppeared: totalRaces - val.lastIndex
        };
      });
  };

  return {
    Quinella: format("Quinella"),
    Trifecta: format("Trifecta"),
    "First Four": format("First Four")
  };
};

/* =========================================================
   TOP FEATURED
========================================================= */
export const getTrackSideTopEntries = async (req, res) => {
  try {
    console.log("\n TOP FEATURED API HIT");

    const raceDocs = [];
    for (const M of MODELS) {
      const data = await M.find({}, { runners: 1 });
      console.log(` ${M.modelName} records:`, data.length);
      raceDocs.push(...data);
    }

    console.log(" Total races fetched:", raceDocs.length);

    const map = { Quinella: {}, Trifecta: {}, "First Four": {} };

    raceDocs.forEach((race, index) => {
      console.log(`\n Processing race index: ${index}`);

      const sorted = getValidSortedRunners(race.runners);
      console.log(" Sorted count:", sorted.length);

      if (sorted.length < 4) {
        console.log(" Skipping race — less than 4 valid runners");
        return;
      }

      const q = sorted.slice(0, 2).map(r => r.horseNo).join("-");
      const t = sorted.slice(0, 3).map(r => r.horseNo).join("-");
      const f = sorted.slice(0, 4).map(r => r.horseNo).join("-");

      console.log(" Combos:", { q, t, f });

      [[q,"Quinella"],[t,"Trifecta"],[f,"First Four"]].forEach(
        ([key, type]) => {
          if (!map[type][key]) {
            map[type][key] = { count: 0, lastIndex: index };
          }
          map[type][key].count++;
          map[type][key].lastIndex = index;
        }
      );
    });

    const data = buildResponse(map, raceDocs.length, "top");

    console.log("\n FINAL RESPONSE:", data);

    res.json({ success: true, data });
  } catch (err) {
    console.error(" ERROR:", err);
    res.status(500).json({ success:false, message: err.message });
  }
};

/* =========================================================
   LEAST FEATURED
========================================================= */
export const getTrackSideLeastEntries = async (req, res) => {
  try {
    console.log("\n LEAST FEATURED API HIT");

    const raceDocs = [];
    for (const M of MODELS) {
      const data = await M.find({}, { runners: 1 });
      console.log(` ${M.modelName} records:`, data.length);
      raceDocs.push(...data);
    }

    console.log(" Total races fetched:", raceDocs.length);

    const map = { Quinella: {}, Trifecta: {}, "First Four": {} };

    raceDocs.forEach((race, index) => {
      console.log(`\n Processing race index: ${index}`);

      const sorted = getValidSortedRunners(race.runners);
      console.log(" Sorted count:", sorted.length);

      if (sorted.length < 4) {
        console.log("Skipping race — less than 4 valid runners");
        return;
      }

      const q = sorted.slice(0, 2).map(r => r.horseNo).join("-");
      const t = sorted.slice(0, 3).map(r => r.horseNo).join("-");
      const f = sorted.slice(0, 4).map(r => r.horseNo).join("-");

      console.log(" Combos:", { q, t, f });

      [[q,"Quinella"],[t,"Trifecta"],[f,"First Four"]].forEach(
        ([key, type]) => {
          if (!map[type][key]) {
            map[type][key] = { count: 0, lastIndex: index };
          }
          map[type][key].count++;
          map[type][key].lastIndex = index;
        }
      );
    });

    const data = buildResponse(map, raceDocs.length, "least");

    console.log("\n FINAL RESPONSE:", data);

    res.json({ success: true, data });
  } catch (err) {
    console.error(" ERROR:", err);
    res.status(500).json({ success:false, message: err.message });
  }
};
