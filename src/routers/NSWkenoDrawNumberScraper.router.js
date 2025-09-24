import express from "express";
import {
  scrapeNSWKeno,
  scrapeNSWKenobyGame,
  getKenoResults,
  getFilteredKenoResults,
} from "../controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

// router.get("/nsw", scrapeAndParseNSWKeno);
router.get("/latest", async (req, res) => {
  try {
    const results = await scrapeNSWKeno();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/latestbyGame", async (req, res) => {
  try {
    const results = await scrapeNSWKenobyGame();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/keno-results", verifyAPIKey, getKenoResults);
router.get("/applyfilters", verifyAPIKey, getFilteredKenoResults);

export default router;
