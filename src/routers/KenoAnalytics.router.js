import express from "express";
import { getTop10Keno, getTop10Keno24h } from "../controllers/KenoAnalytics/KenoAnalytics.controller.js";
import auth from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

router.get("/top-10", auth, checkSubscription, getTop10Keno);
router.get("/top-10-24h", auth, checkSubscription, getTop10Keno24h);

export default router;
