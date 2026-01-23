import express from "express";
import { analyzeTracksideHistoricalFrequency } from "../controllers/ExoticPredictor/tracksideHistoricalFrequency.controller.js";
import { analyzeHistoricalFrequency as analyzeKenoHistoricalFrequency } from "../controllers/ExoticPredictor/kenoHistoricalFrequency.controller.js";

const router = express.Router();

router.post("/trackside", analyzeTracksideHistoricalFrequency);
router.post("/keno", analyzeKenoHistoricalFrequency);

export default router;


