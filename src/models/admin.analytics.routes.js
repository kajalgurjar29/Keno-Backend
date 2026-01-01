import express from "express";
import {
  getMetrics,
  getAutomationRate,
  getEscalationRate,
  getFRT,
  getResolutionTime,
  getAgents,
} from "../controllers/Admin/analytics.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/admin.middleware.js";

const router = express.Router();

router.get("/metrics", authMiddleware, isAdmin, getMetrics);
router.get("/automation-rate", authMiddleware, isAdmin, getAutomationRate);
router.get("/escalation-rate", authMiddleware, isAdmin, getEscalationRate);
router.get("/frt", authMiddleware, isAdmin, getFRT);
router.get("/resolution-time", authMiddleware, isAdmin, getResolutionTime);
router.get("/agents", authMiddleware, isAdmin, getAgents);

export default router;
