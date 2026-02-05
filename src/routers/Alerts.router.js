import express from "express";
import { createAlert, getUserAlerts, updateAlert, deleteAlert, getTracksideAlerts, getKenoAlerts } from "../controllers/Alerts/Alerts.controller.js";
import auth from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

// Apply auth and subscription check to all routes
router.use(auth);
router.use(checkSubscription);

router.post("/", createAlert);
router.get("/user/:userId", getUserAlerts);
router.get("/trackside/:userId", getTracksideAlerts);
router.get("/keno/:userId", getKenoAlerts);
router.put("/:alertId", updateAlert);
router.delete("/:alertId", deleteAlert);

export default router;