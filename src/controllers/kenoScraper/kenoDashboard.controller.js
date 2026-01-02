import KenoResult from "../../models/NSWkenoDrawResult.model.js";

export const getKenoDashboardStats = async (req, res) => {
  try {
    const totalKenoDraws = await KenoResult.countDocuments();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const totalRacesToday = await KenoResult.countDocuments({
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
