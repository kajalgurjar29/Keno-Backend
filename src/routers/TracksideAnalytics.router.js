import express from "express";
import { getTop10Exotics } from "../controllers/TracksideAnalytics/TracksideAnalytics.controller.js";

const router = express.Router();

router.get("/top-10", getTop10Exotics);

export default router;
