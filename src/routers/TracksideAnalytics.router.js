import express from "express";
import { getTop10Exotics, getTracksideHorseEntryDetails } from "../controllers/TracksideAnalytics/TracksideAnalytics.controller.js";
import auth from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

router.get("/top-10", auth, checkSubscription, getTop10Exotics);
router.get("/horse-details/:horseNo", auth, checkSubscription, getTracksideHorseEntryDetails);

export default router;
