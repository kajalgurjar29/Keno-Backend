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

router.use(auth);
router.use(checkSubscription);

// Analyze all locations and generate overdue combos
router.get("/generate/", getOverdueCombos);
router.get("/generate/pagination", getOverdueCombospagination);

// Analyze Trackside locations and generate overdue combos
router.get("/trackside/generate/", getTracksideOverdue);
router.get("/trackside/generate/pagination", getTracksideOverduePagination);

export default router;
