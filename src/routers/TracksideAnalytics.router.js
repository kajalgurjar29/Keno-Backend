import express from "express";
import { getTop10Exotics, getTop10Exotics24h, getTracksideHorseEntryDetails } from "../controllers/TracksideAnalytics/TracksideAnalytics.controller.js";
import auth from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

router.get("/top-10", auth, checkSubscription, getTop10Exotics);
router.get("/top-10-24h", auth, checkSubscription, getTop10Exotics24h);
router.get("/horse-details/:horseNo", auth, checkSubscription, getTracksideHorseEntryDetails);

export default router;
