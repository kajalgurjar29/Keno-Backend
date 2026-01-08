import Combination from "../../models/combination.model.js";

export const getBetComparison = async (req, res) => {
  try {
    const data = await Combination.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" }
          },
          Exotic: { $sum: 1 }
        }
      },
      { $sort: { "_id.month": 1 } }
    ]);

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const formatted = data.map(item => ({
      name: months[item._id.month - 1],
      Standard: 0,              
      Exotic: item.Exotic
    }));

    res.status(200).json({
      success: true,
      data: formatted
    });

  } catch (error) {
    console.error("Bet Comparison Error:", error);
    res.status(500).json({
      success: false,
      message: "Bet comparison failed"
    });
  }
};
