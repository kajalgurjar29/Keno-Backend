import NSW from "../../models/NSWkenoDrawResult.model.js";
import VIC from "../../models/VICkenoDrawResult.model.js";
import ACT from "../../models/ACTkenoDrawResult.model.js";
import SA from "../../models/SAkenoDrawResult.model.js";

const MODELS = [NSW, VIC, ACT, SA];

export const getKenoTopEntries = async (req, res) => {
  try {
    const draws = [];
    for (const M of MODELS) {
      draws.push(...await M.find({}, { numbers: 1, createdAt: 1 }));
    }

    const totalRaces = draws.length;
    const map = { Quinella:{}, Trifecta:{}, "First Four":{} };

    draws.forEach((d, i) => {
      const q = d.numbers.slice(0,2).join("-");
      const t = d.numbers.slice(0,3).join("-");
      const f = d.numbers.slice(0,4).join("-");

      [[q,"Quinella"],[t,"Trifecta"],[f,"First Four"]].forEach(([k,t])=>{
        if (!map[t][k]) map[t][k]={count:0,lastIndex:i};
        map[t][k].count++; map[t][k].lastIndex=i;
      });
    });

    const format = (type) =>
      Object.entries(map[type])
        .sort((a,b)=>b[1].count-a[1].count)
        .slice(0,3)
        .map(([c,v])=>({
          entries: c.split("-").map(Number),
          winPercentage: Number(((v.count/totalRaces)*100).toFixed(1)),
          avg: Math.round(totalRaces/v.count),
          lastAppeared: totalRaces-v.lastIndex
        }));

    res.json({
      success:true,
      data:{
        Quinella:format("Quinella"),
        Trifecta:format("Trifecta"),
        "First Four":format("First Four")
      }
    });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
};


export const getKenoLeastEntries = async (req, res) => {
  try {
    const draws = [];
    for (const M of MODELS) {
      draws.push(...await M.find({}, { numbers: 1, createdAt: 1 }));
    }

    const totalRaces = draws.length;

    const map = {
      Quinella: {},
      Trifecta: {},
      "First Four": {}
    };

    draws.forEach((d, i) => {
      const q = d.numbers.slice(0, 2).join("-");
      const t = d.numbers.slice(0, 3).join("-");
      const f = d.numbers.slice(0, 4).join("-");

      [[q, "Quinella"], [t, "Trifecta"], [f, "First Four"]].forEach(
        ([k, type]) => {
          if (!map[type][k]) {
            map[type][k] = { count: 0, lastIndex: i };
          }
          map[type][k].count++;
          map[type][k].lastIndex = i;
        }
      );
    });

  const expectedLength = {
  Quinella: 2,
  Trifecta: 3,
  "First Four": 4
};

const format = (type) =>
  Object.entries(map[type])
    .filter(([c]) => c.split("-").length === expectedLength[type]) // ✅ FIX
    .sort((a, b) => a[1].count - b[1].count)
    .slice(0, 3)
    .map(([c, v]) => ({
      entries: c.split("-").map(Number),
      winPercentage: Number(((v.count / totalRaces) * 100).toFixed(1)),
      avg: Math.round(totalRaces / v.count),
      lastAppeared: totalRaces - v.lastIndex
    }));


    res.json({
      success: true,
      data: {
        Quinella: format("Quinella"),
        Trifecta: format("Trifecta"),
        "First Four": format("First Four")
      }
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e.message
    });
  }
};
