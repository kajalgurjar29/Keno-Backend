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

export const getHotColdNumbers = async (req, res) => {
  try {
    const { location = "NSW" } = req.query;
    const lookback = parseInt(req.query.lookback) || 50;
    const Model = getModel(location);

    // 🔹 Recent draws
    const draws = await Model.find({ numbers: { $size: 20 } })
      .sort({ createdAt: -1 })
      .limit(lookback);

    if (!draws.length) {
      return res.status(404).json({ message: `No keno data found for ${location}` });
    }

    // 🔹 Frequency map
    const freq = {};
    draws.forEach(d =>
      d.numbers.forEach(num => {
        freq[num] = (freq[num] || 0) + 1;
      })
    );

    // 🔹 Sort numbers by frequency
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

    const hotNumbers = sorted.slice(0, 2).map(([num]) => Number(num));
    const coldNumbers = sorted.slice(-2).map(([num]) => Number(num));

    // 🔹 Latest draw for card display
    const latest = draws[0];

    res.status(200).json({
      success: true,
      location: location.toUpperCase(),
      draw: `#${latest.draw}`,
      time: latest.date || latest.createdAt,
      hotNumbers,
      coldNumbers,
      numbers: latest.numbers,
    });
  } catch (err) {
    console.error("❌ Hot/Cold API error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
