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

export const getKenoDashboardStats = async (req, res) => {
  try {
    const { location = "NSW" } = req.query;
    const Model = getModel(location);

    const totalKenoDraws = await Model.countDocuments();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const totalRacesToday = await Model.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const activeScrappers = Number(process.env.ACTIVE_SCRAPPERS) || 1;


    const errorsToday = 0;

    res.status(200).json({
      success: true,
      data: {
        totalKenoDraws,
        totalRacesToday,
        activeScrappers,
        errorsToday,
      },
    });
  } catch (err) {
    console.error(" Dashboard stats error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard stats",
    });
  }
};
