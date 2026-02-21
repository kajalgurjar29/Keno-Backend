import NSWKeno from "../../models/NSWkenoDrawResult.model.js";
import VICKeno from "../../models/VICkenoDrawResult.model.js";
import ACTKeno from "../../models/ACTkenoDrawResult.model.js";
import SAKeno from "../../models/SAkenoDrawResult.model.js";

const getModel = (location) => {
  switch (location?.toUpperCase()) {
    case "VIC": return VICKeno;
    case "ACT": return ACTKeno;
    case "SA": return SAKeno;
    default: return NSWKeno;
  }
};

export const getNumberFrequency = async (req, res) => {
  try {
    const { location } = req.query;
    const lookback = parseInt(req.query.lookback) || 50;
    const top = parseInt(req.query.top) || 10;
    const Model = getModel(location);

    const draws = await Model.find({ numbers: { $size: 20 } })
      .sort({ createdAt: -1 })
      .limit(lookback);

    if (!draws.length) {
      return res.status(404).json({ message: `No keno data found for ${location || "NSW"}` });
    }

    const freqMap = {};
    draws.forEach(draw => {
      draw.numbers.forEach(num => {
        freqMap[num] = (freqMap[num] || 0) + 1;
      });
    });

    const chartData = Object.entries(freqMap)
      .map(([num, count]) => ({
        name: num,
        value: count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, top);

    res.status(200).json({
      success: true,
      lookback,
      location: location || "NSW",
      data: chartData,
    });
  } catch (err) {
    console.error(" Frequency API error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const getOddEvenDistribution = async (req, res) => {
  try {
    const { location } = req.query;
    const lookback = parseInt(req.query.lookback) || 50;
    const Model = getModel(location);

    const draws = await Model.find({ numbers: { $size: 20 } })
      .sort({ createdAt: -1 })
      .limit(lookback);

    if (!draws.length) {
      return res.status(404).json({ message: `No keno data found for ${location || "NSW"}` });
    }

    let oddCount = 0;
    let evenCount = 0;

    draws.forEach(draw => {
      draw.numbers.forEach(num => {
        if (num % 2 === 0) evenCount++;
        else oddCount++;
      });
    });

    res.status(200).json({
      success: true,
      lookback,
      location: location || "NSW",
      data: [
        { name: "Odd", value: oddCount },
        { name: "Even", value: evenCount },
      ],
    });
  } catch (err) {
    console.error(" Odd-Even API error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
