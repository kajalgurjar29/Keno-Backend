import express from "express";
import {
  getOverdueCombos,
  getOverdueCombospagination,
} from "../controllers/ExoticPredictor/kenoOverdue.controller.js";
import {
  getTracksideOverdue,
  getTracksideOverduePagination,
} from "../controllers/ExoticPredictor/tracksideOverdue.controller.js";

import auth from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

// Analyze all locations and generate overdue combos
router.get("/generate/", auth, checkSubscription, getOverdueCombos);
router.get("/generate/pagination", auth, checkSubscription, getOverdueCombospagination);

// Analyze Trackside locations and generate overdue combos
router.get("/trackside/generate/", auth, checkSubscription, getTracksideOverdue);
router.get("/trackside/generate/pagination", auth, checkSubscription, getTracksideOverduePagination);

export default router;
