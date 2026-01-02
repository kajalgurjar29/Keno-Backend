import KenoResult from "../../models/NSWkenoDrawResult.model.js";

export const getHotColdNumbers = async (req, res) => {
  try {
    const lookback = parseInt(req.query.lookback) || 50; 
    // last 50 draws se calculate

    // 🔹 Recent draws
    const draws = await KenoResult.find()
      .sort({ createdAt: -1 })
      .limit(lookback);

    if (!draws.length) {
      return res.status(404).json({ message: "No keno data found" });
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
      draw: `#${latest.draw}`,
      time: latest.date,
      hotNumbers,
      coldNumbers,
      numbers: latest.numbers,
    });
  } catch (err) {
    console.error("❌ Hot/Cold API error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
