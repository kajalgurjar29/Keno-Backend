import express from "express";
import {
    addFavorite,
    getFavorites,
    removeFavorite,
} from "../controllers/FavoritesSection/TracksiteFavoriteSection.comtroller.js";

const router = express.Router();

router.post("/add", addFavorite);
router.get("/:userId", getFavorites);
router.delete("/remove/:id", removeFavorite);

export default router;
