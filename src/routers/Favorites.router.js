import express from "express";
import {
  likeResult,
  unlikeResult,
  getUserFavorites,
} from "../controllers/FavoritesSection/TracksiteFavoriteSection.comtroller.js";

const router = express.Router();

router.post("/like", likeResult);

router.delete("/:id", unlikeResult);

router.get("/user/:userId", getUserFavorites);

export default router;
