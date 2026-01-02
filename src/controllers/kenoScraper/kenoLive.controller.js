import KenoResult from "../../models/NSWkenoDrawResult.model.js";

export const getLiveKenoResult = async (req, res) => {
  try {
    // 🔥 Always fetch latest NSW draw
    const result = await KenoResult.findOne()
      .sort({ createdAt: -1 }); // or .sort({ _id: -1 })

    if (!result) {
      return res.status(404).json({
        message: "No NSW keno result available",
      });
    }

    res.status(200).json({
      label: "Keno NSW",
      draw: result.draw,
      date: result.date,
      numbers: result.numbers,
      location: result.location,
    });
  } catch (err) {
    console.error("❌ getLiveKenoResult error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};




export const getKenoDrawHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const results = await KenoResult.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedData = results.map((item) => ({
      race: `#${item.draw}`,
      time: item.date, // agar future me time mile to yahan update
      number: item.numbers.join("-"),
      status: "Completed",
    }));

    res.status(200).json({
      success: true,
      page,
      limit,
      data: formattedData,
    });
  } catch (err) {
    console.error("❌ getKenoDrawHistory error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch draw history",
    });
  }
};
