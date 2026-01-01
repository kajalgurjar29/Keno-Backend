import express from "express";
import { getKenoDashboardStats } from "../controllers/kenoScraper/kenoDashboard.controller.js";

const router = express.Router();

router.get("/keno/dashboard-stats", getKenoDashboardStats);

export default router;
