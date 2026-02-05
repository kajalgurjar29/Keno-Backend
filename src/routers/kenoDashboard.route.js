import express from "express";
import { getKenoDashboardStats } from "../controllers/kenoScraper/kenoDashboard.controller.js";
import auth from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

router.get("/keno/dashboard-stats", auth, checkSubscription, getKenoDashboardStats);

export default router;
