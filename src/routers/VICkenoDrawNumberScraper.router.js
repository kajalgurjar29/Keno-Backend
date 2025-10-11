import express from "express";
import {
  scrapeVICKeno,
  scrapeVICKenoByGame,
  getKenoResultsVic,
  getFilteredKenoResultsVic,
} from "../controllers/kenoScraper/VICkenoDrawNumberScraper.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

// router.get("/nsw", scrapeAndParseNSWKeno);
router.get("/vic-latest", async (req, res) => {
  try {
    const data = await scrapeVICKeno();
    res.status(200).json({
      success: true,
      message: "VIC Keno results scraped successfully",
      data,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to scrape VIC Keno results",
      error: error.message,
    });
  }
});

router.get("/latestbyGame", async (req, res) => {
  try {
    const results = await scrapeVICKenoByGame();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/keno-results-vic", verifyAPIKey, getKenoResultsVic);
router.get("/applyfilters-vic", verifyAPIKey, getFilteredKenoResultsVic);

export default router;
