import express from "express";
import { generateTracksideExoticPredictions } from "../controllers/ExoticPredictor/tracksideCombination.controller.js";
import { generateKenoCombinationPredictions } from "../controllers/ExoticPredictor/kenoCombination.controller.js";
import { getBetComparison } from "../controllers/ExoticPredictor/betComparison.controller.js";
const router = express.Router();

router.post("/trackside", generateTracksideExoticPredictions);
router.post("/keno", generateKenoCombinationPredictions);
router.get("/bet-comparison", getBetComparison);

export default router;
