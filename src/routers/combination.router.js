import express from "express";
import { generateExoticPredictions } from "../controllers/ExoticPredictor/Combination.controller.js";
import { getBetComparison } from "../controllers/ExoticPredictor/betComparison.controller.js";
const router = express.Router();

router.post("/data", generateExoticPredictions); // GET /api/exotic/data?location=VIC&date=2025-10-15
router.get("/bet-comparison", getBetComparison);

export default router;
