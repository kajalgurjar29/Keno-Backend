import express from "express";
import verifyAPIKey from "../middleware/verifyAPIKey.js";
import {
  getCombinedKenoQuickStats,
  getKenoGraphStats,
} from "../controllers/kenoScraper/getCombinedKenoQuickStats.js";
import {
  getTrackSideQuickStats,
  getTracksideGraphStats,
} from "../controllers/kenoScraper/horseQuickStats.controller.js";

const router = express.Router();

// Original endpoints
router.get("/keno/quick-stats", verifyAPIKey, getCombinedKenoQuickStats);
router.get("/trackside/quick-stats", verifyAPIKey, getTrackSideQuickStats);

// New graph-ready endpoints
router.get("/keno/graph-stats", verifyAPIKey, getKenoGraphStats);
router.get("/trackside/graph-stats", verifyAPIKey, getTracksideGraphStats);

export default router;
