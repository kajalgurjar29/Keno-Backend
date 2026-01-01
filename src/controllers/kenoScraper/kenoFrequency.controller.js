import KenoResult from "../../models/NSWkenoDrawResult.model.js";

export const getNumberFrequency = async (req, res) => {
  try {
    const lookback = parseInt(req.query.lookback) || 50;
    const top = parseInt(req.query.top) || 10;

    const draws = await KenoResult.find()
      .sort({ createdAt: -1 })
      .limit(lookback);

    if (!draws.length) {
      return res.status(404).json({ message: "No keno data found" });
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
      data: chartData,
    });
  } catch (err) {
    console.error(" Frequency API error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};



export const getOddEvenDistribution = async (req, res) => {
  try {
    const lookback = parseInt(req.query.lookback) || 50;

    // 🔹 Last N draws
    const draws = await KenoResult.find()
      .sort({ createdAt: -1 })
      .limit(lookback);

    if (!draws.length) {
      return res.status(404).json({ message: "No keno data found" });
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
