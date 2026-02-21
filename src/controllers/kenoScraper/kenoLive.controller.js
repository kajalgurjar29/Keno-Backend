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

export const getLiveKenoResult = async (req, res) => {
  try {
    const { location } = req.query;
    const Model = getModel(location);

    const result = await Model.findOne({ numbers: { $size: 20 } })
      .sort({ createdAt: -1 });

    if (!result) {
      return res.status(404).json({
        message: `No ${location || "NSW"} keno result available`,
      });
    }

    res.status(200).json({
      label: `Keno ${result.location || "NSW"}`,
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
    const { location } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const Model = getModel(location);

    const results = await Model.find({ numbers: { $size: 20 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedData = results.map((item) => ({
      race: `#${item.draw}`,
      time: item.date,
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
    const { location } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const Model = getModel(location);

    const results = await Model.find({ numbers: { $size: 20 } })
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
