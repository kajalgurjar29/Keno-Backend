import express from "express";
import {
  getTrackSideTopEntries,
  getTrackSideLeastEntries
} from "../controllers/Featured/TopFeaturedTrackSide.js";

const router = express.Router();

router.get("/top-featured", getTrackSideTopEntries);

router.get("/least-featured", getTrackSideLeastEntries);

export default router;
