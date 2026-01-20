import express from "express";
import { getTop10Keno } from "../controllers/KenoAnalytics/KenoAnalytics.controller.js";

const router = express.Router();

router.get("/top-10", getTop10Keno);

export default router;
