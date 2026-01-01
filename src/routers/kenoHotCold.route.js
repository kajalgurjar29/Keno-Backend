import express from "express";
import { getHotColdNumbers } from "../controllers/kenoScraper/kenoHotCold.controller.js";

const router = express.Router();

router.get("/keno/nsw/hot-cold", getHotColdNumbers);

export default router;
