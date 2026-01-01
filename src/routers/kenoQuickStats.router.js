import express from "express";
import verifyAPIKey from "../middleware/verifyAPIKey.js";
import { getCombinedKenoQuickStats } from "../controllers/kenoScraper/getCombinedKenoQuickStats.js";
import { getTrackSideQuickStats } from "../controllers/kenoScraper/horseQuickStats.controller.js";

const router = express.Router();

router.get("/quick-stats", verifyAPIKey, getCombinedKenoQuickStats);
router.get("/trackside/quick-stats", verifyAPIKey, getTrackSideQuickStats);

export default router;
