import express from "express";
import {
  scrapeATCKeno,
  scrapeACTKenoByGame,
  getKenoResultsAtc,
  getFilteredKenoResultsAtc,
} from "../controllers/kenoScraper/ACTkenoDrawNumberScraper.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

// router.get("/nsw", scrapeAndParseNSWKeno);
router.get("/atc-latest", async (req, res) => {
  try {
    const data = await scrapeATCKeno();
    res.status(200).json({
      success: true,
      message: "ATC Keno results scraped successfully",
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
    const results = await scrapeACTKenoByGame();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/keno-results", verifyAPIKey, getKenoResultsAtc);
router.get("/applyfilters", verifyAPIKey, getFilteredKenoResultsAtc);

export default router;
