// routes/kenoLive.route.js
import express from "express";
import { getLiveKenoResult, getKenoDrawHistory, getKenoHeadsTailsHistory } from "../controllers/kenoScraper/kenoLive.controller.js";
import { getNumberFrequency, getOddEvenDistribution } from "../controllers/kenoScraper/kenoFrequency.controller.js";
import { getUpcomingKenoDraw, getUpcomingTracksideDraw } from "../controllers/kenoScraper/UpcomingKenoDraw.js";

const router = express.Router();

router.get("/keno/live-result", getLiveKenoResult);
router.get("/keno/draw-history", getKenoDrawHistory);
router.get("/keno/heads-tails-history", getKenoHeadsTailsHistory);
router.get("/keno/number-frequency", getNumberFrequency);
router.get("/keno/odd-even-distribution", getOddEvenDistribution);
router.get("/keno/upcoming-draw", getUpcomingKenoDraw);
router.get("/trackside/upcoming", getUpcomingTracksideDraw);

export default router;
