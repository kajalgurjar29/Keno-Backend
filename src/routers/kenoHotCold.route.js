import express from "express";
import { getHotColdNumbers } from "../controllers/kenoScraper/kenoHotCold.controller.js";
import auth from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

router.get("/keno/nsw/hot-cold", auth, checkSubscription, getHotColdNumbers);

export default router;
