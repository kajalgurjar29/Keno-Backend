import express from "express";
import { createAlert, getUserAlerts, updateAlert, deleteAlert, getTracksideAlerts, getKenoAlerts } from "../controllers/Alerts/Alerts.controller.js";

const router = express.Router();

router.post("/", createAlert);
router.get("/user/:userId", getUserAlerts);
router.get("/trackside/:userId", getTracksideAlerts);
router.get("/keno/:userId", getKenoAlerts);
router.put("/:alertId", updateAlert);
router.delete("/:alertId", deleteAlert);

export default router;