import express from "express";
import { scrapeNSWKeno } from "../controllers/kenoScraper/kenoScraper.controller.js";

const router = express.Router();

// router.get("/nsw", scrapeAndParseNSWKeno);
router.get("/api/keno/latest", async (req, res) => {
  try {
    const results = await scrapeNSWKeno();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
