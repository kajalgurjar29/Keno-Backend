import express from "express";
import { createAlert, getUserAlerts } from "../controllers/Alerts/Alerts.controller.js";

const router = express.Router();

router.post("/", createAlert);
router.get("/user/:userId", getUserAlerts);

export default router;
