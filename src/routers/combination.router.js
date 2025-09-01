// routes/combination.routes.js
import express from "express";
import {
  generateCombinations,
  getCombinations,
  getMostRecentThreeCombinations,
} from "../controllers/ExoticPredictor/Combination.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

router.post("/generate", verifyAPIKey, generateCombinations);
router.get("/get", verifyAPIKey, getCombinations);
router.get("/getMostRecentThree", verifyAPIKey, getMostRecentThreeCombinations);

export default router;
