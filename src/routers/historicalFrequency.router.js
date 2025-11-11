import express from "express";
import { analyzeHistoricalFrequency } from "../controllers/ExoticPredictor/historicalFrequency.controller.js";

const router = express.Router();

// POST /api/v1/historical-frequency/analyze
router.post("/analyze", analyzeHistoricalFrequency);

export default router;


