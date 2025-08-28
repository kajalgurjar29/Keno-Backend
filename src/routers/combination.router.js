// routes/combination.routes.js
import express from "express";
import { generateCombinations } from "../controllers/ExoticPredictor/Combination.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

router.post("/generate", verifyAPIKey, generateCombinations);

export default router;
