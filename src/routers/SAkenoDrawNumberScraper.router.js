import express from "express";
import {
  scrapeSAKeno,
  scrapeSAKenoByGame,
  getKenoResultsSa,
  getFilteredKenoResultsSa,
} from "../controllers/kenoScraper/SAkenoDrawNumberScraper.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

// router.get("/nsw", scrapeAndParseNSWKeno);
router.get("/sa-latest", async (req, res) => {
  try {
    const data = await scrapeSAKeno();
    res.status(200).json({
      success: true,
      message: "SA Keno results scraped successfully",
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
    const results = await scrapeSAKenoByGame();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/keno-results-sa", verifyAPIKey, getKenoResultsSa);
router.get("/applyfilters-sa", verifyAPIKey, getFilteredKenoResultsSa);

export default router;
