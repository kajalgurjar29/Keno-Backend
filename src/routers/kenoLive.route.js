// routes/kenoLive.route.js
import express from "express";
import { getLiveKenoResult } from "../controllers/kenoScraper/kenoLive.controller.js";
import { getKenoDrawHistory } from "../controllers/kenoScraper/kenoLive.controller.js";
import { getNumberFrequency } from "../controllers/kenoScraper/kenoFrequency.controller.js";
import { getOddEvenDistribution } from "../controllers/kenoScraper/kenoFrequency.controller.js";

const router = express.Router();

router.get("/keno/live-result", getLiveKenoResult);
router.get("/keno/draw-history", getKenoDrawHistory);
router.get("/keno/number-frequency", getNumberFrequency);
router.get("/keno/odd-even-distribution", getOddEvenDistribution);

export default router;
