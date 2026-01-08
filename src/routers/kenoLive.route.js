// routes/kenoLive.route.js
import express from "express";
import { getLiveKenoResult } from "../controllers/kenoScraper/kenoLive.controller.js";
import { getKenoDrawHistory } from "../controllers/kenoScraper/kenoLive.controller.js";
import { getNumberFrequency } from "../controllers/kenoScraper/kenoFrequency.controller.js";
import { getOddEvenDistribution } from "../controllers/kenoScraper/kenoFrequency.controller.js";
import { getUpcomingKenoDraw , getUpcomingTracksideDraw } from "../controllers/kenoScraper/UpcomingKenoDraw.js";

const router = express.Router();

router.get("/keno/live-result", getLiveKenoResult);
router.get("/keno/draw-history", getKenoDrawHistory);
router.get("/keno/number-frequency", getNumberFrequency);
router.get("/keno/odd-even-distribution", getOddEvenDistribution);
router.get("/keno/upcoming-draw", getUpcomingKenoDraw);
router.get("/trackside/upcoming", getUpcomingTracksideDraw);

export default router;
