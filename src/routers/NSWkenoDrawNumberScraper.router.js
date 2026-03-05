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

// Alias for consistency with other regions
router.get("/nsw-latest", async (req, res) => {
  try {
    const data = await scrapeNSWKeno();
    res.status(200).json({
      success: true,
      message: "NSW Keno results scraped successfully",
      data,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to scrape NSW Keno results",
      error: error.message,
    });
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
router.get("/keno-results-nsw", verifyAPIKey, getKenoResults); // Alias for consistency
router.get("/applyfilters", verifyAPIKey, getFilteredKenoResults);
router.get("/applyfilters-nsw", verifyAPIKey, getFilteredKenoResults); // Alias for consistency

export default router;
