import express from "express";
import { getTop10Keno } from "../controllers/KenoAnalytics/KenoAnalytics.controller.js";
import auth from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

router.get("/top-10", auth, checkSubscription, getTop10Keno);

export default router;
