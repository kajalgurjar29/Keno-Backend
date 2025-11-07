import express from "express";
import {
  getOverdueCombos,
  getOverdueCombospagination,
} from "../controllers/ExoticPredictor/overdueCombo.controller.js";

const router = express.Router();

// Analyze all locations and generate overdue combos
router.get("/generate/", getOverdueCombos);
router.get("/generate/pagination", getOverdueCombospagination);

export default router;
