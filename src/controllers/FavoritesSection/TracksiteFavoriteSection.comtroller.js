import Favorite from "../../models/Favorite.model.js";
import VICTrackSideResult from "../../models/TrackSideResult.VIC.model.js";
import KenoResult from "../../models/KenoResult.model.js";

/* LIKE (TrackSide VIC + Keno)*/
export const likeResult = async (req, res) => {
  try {
    const { userId, gameType, resultId, numbers } = req.body;

    if (!userId || !gameType || !resultId || !Array.isArray(numbers)) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    const alreadyLiked = await Favorite.findOne({
      userId,
      gameType,
      resultId,
    });

    if (alreadyLiked) {
      return res.status(409).json({ message: "Already liked" });
    }

    //  ensure result exists
    let ResultModel;
    if (gameType === "TRACKSIDE") ResultModel = VICTrackSideResult;
    if (gameType === "KENO") ResultModel = KenoResult;

    if (!ResultModel) {
      return res.status(400).json({ message: "Invalid game type" });
    }

    const resultExists = await ResultModel.findById(resultId);
    if (!resultExists) {
      return res.status(404).json({ message: "Result not found" });
    }

    //  save favorite
    const favorite = await Favorite.create({
      userId,
      gameType,
      resultId,
      numbers,
    });

    return res.status(201).json({
      message: "Liked successfully",
      favorite,
    });
  } catch (error) {
    console.error("LIKE ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/*  UNLIKE */
export const unlikeResult = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Favorite ID required" });
    }

    const deleted = await Favorite.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Favorite not found" });
    }

    return res.status(200).json({
      message: "Unliked successfully",
    });
  } catch (error) {
    console.error("UNLIKE ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* GET USER FAVORITES */
export const getUserFavorites = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const favorites = await Favorite.find({ userId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      favorites,
    });
  } catch (error) {
    console.error("GET FAVORITES ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
