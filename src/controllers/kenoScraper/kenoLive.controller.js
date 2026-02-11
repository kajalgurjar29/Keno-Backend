import KenoResult from "../../models/NSWkenoDrawResult.model.js";

export const getLiveKenoResult = async (req, res) => {
  try {
    // 🔥 Always fetch latest NSW draw
    const result = await KenoResult.findOne({ numbers: { $size: 20 } })
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

    const results = await KenoResult.find({ numbers: { $size: 20 } })
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

export const getKenoHeadsTailsHistory = async (req, res) => {
  try {
    const { location } = req.query; // Optional filter by state
    const limit = parseInt(req.query.limit) || 20;

    let query = {};
    if (location) {
      query.location = location;
    }
    query.numbers = { $size: 20 };

    // We can fetch from all models if needed, but for a "Table" usually we show per state or latest overall.
    // Let's stick to the current model for now or import others.
    // Actually, KenoResult in this file is NSW. 

    const results = await KenoResult.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const tableData = results.map((item) => ({
      draw: item.draw,
      date: item.date,
      winner: item.result || (item.heads > item.tails ? "Heads wins" : item.tails > item.heads ? "Tails wins" : "Evens wins"),
      headsCount: item.heads,
      tailsCount: item.tails,
      bonus: item.bonus || "REG",
      numbers: item.numbers
    }));

    res.status(200).json({
      success: true,
      data: tableData,
    });
  } catch (err) {
    console.error("❌ getKenoHeadsTailsHistory error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
