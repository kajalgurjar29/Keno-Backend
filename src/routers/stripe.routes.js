import express from "express";
import { stripeWebhook } from "../controllers/payment/webhook.controller.js";

const router = express.Router();

// Stripe requires the raw body to verify the signature
// This middleware will capture the raw body for this specific route
router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook
);

export default router;
