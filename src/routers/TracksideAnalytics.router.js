import express from "express";
import { getTop10Exotics, getTracksideHorseEntryDetails } from "../controllers/TracksideAnalytics/TracksideAnalytics.controller.js";

const router = express.Router();

router.get("/top-10", getTop10Exotics);
router.get("/horse-details/:horseNo", getTracksideHorseEntryDetails);

export default router;
