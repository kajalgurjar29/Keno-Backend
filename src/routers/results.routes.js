import express from "express";
import { getLatestTrackSideResult } from "../controllers/TracksiteScaper/results.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";
import { getLatestResults } from "../controllers/TracksiteScaper/results.controller.js";

const router = express.Router();

router.get("/trackside/latest", verifyAPIKey, getLatestTrackSideResult);
router.get("/keno/latest", verifyAPIKey, getLatestResults);

export default router;
