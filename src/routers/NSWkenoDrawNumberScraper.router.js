import express from "express";
import {
  scrapeNSWKeno,
  scrapeNSWKenobyGame,
  getKenoResults,
} from "../controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";

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

router.get("/keno-results", getKenoResults);

export default router;
