import express from "express";
import { generateExoticPredictions } from "../controllers/ExoticPredictor/Combination.controller.js";

const router = express.Router();

router.post("/data", generateExoticPredictions); // GET /api/exotic/data?location=VIC&date=2025-10-15

export default router;
