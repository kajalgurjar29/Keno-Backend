import express from "express";
import {
  scrapeTrackSideResults,
  scrapeTrackSideResultsWithRetry,
  getLatestTrackSideResults,
  getFilteredTrackSideResults,
  getPaginatedTrackSideResultsOnly,
  getFilteredTrackSideResultsOnly,
} from "../controllers/TracksiteScaper/ACTTrackSideScraperScaping.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

router.get("/latest", async (req, res) => {
  try {
    const results = await scrapeTrackSideResults();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/latestbyGame", async (req, res) => {
  try {
    const results = await scrapeTrackSideResultsWithRetry();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/track-results/ATC", verifyAPIKey, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const results = await getLatestTrackSideResults("ACT", limit);
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/filter-results/ACT", verifyAPIKey, async (req, res) => {
  try {
    const results = await getFilteredTrackSideResults(req.query);
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ NEW: Pagination Only
router.get("/paginated-results-only/ACT", verifyAPIKey, async (req, res) => {
  try {
    const results = await getPaginatedTrackSideResultsOnly(req.query);
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ NEW: Filter Only
router.get("/filtered-results-only/ACT", verifyAPIKey, async (req, res) => {
  try {
    const results = await getFilteredTrackSideResultsOnly(req.query);
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
