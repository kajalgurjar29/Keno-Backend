import express from "express";
import { analyzeTracksideHistoricalFrequency } from "../controllers/ExoticPredictor/tracksideHistoricalFrequency.controller.js";
import { analyzeHistoricalFrequency as analyzeKenoHistoricalFrequency } from "../controllers/ExoticPredictor/kenoHistoricalFrequency.controller.js";
import auth from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

router.use(auth);
router.use(checkSubscription);

router.post("/trackside", analyzeTracksideHistoricalFrequency);
router.post("/keno", analyzeKenoHistoricalFrequency);

export default router;


