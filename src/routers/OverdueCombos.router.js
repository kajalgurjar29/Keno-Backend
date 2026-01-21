import express from "express";
import {
  getOverdueCombos,
  getOverdueCombospagination,
} from "../controllers/ExoticPredictor/kenoOverdue.controller.js";
import {
  getTracksideOverdue,
  getTracksideOverduePagination,
} from "../controllers/ExoticPredictor/tracksideOverdue.controller.js";

const router = express.Router();

// Analyze all locations and generate overdue combos
router.get("/generate/", getOverdueCombos);
router.get("/generate/pagination", getOverdueCombospagination);

// Analyze Trackside locations and generate overdue combos
router.get("/trackside/generate/", getTracksideOverdue);
router.get("/trackside/generate/pagination", getTracksideOverduePagination);

export default router;
