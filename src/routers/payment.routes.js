import express from "express";
import { createCheckout, cancelSubscription, getPaymentHistory, verifyStatus, verifyCheckoutSession } from "../controllers/payment/payment.controller.js";
import { devAutoActivate } from "../controllers/payment/webhook.controller.js";
import auth from "../middleware/auth.middleware.js";

const router = express.Router();

// Payment endpoints
router.post("/checkout", auth, createCheckout);
router.post("/create-checkout", auth, createCheckout);
router.post("/cancel", auth, cancelSubscription);
router.get("/history", auth, getPaymentHistory);
// verifyCheckoutSession is called from Stripe redirect and should work even if token is missing
router.get("/verify-checkout-session", verifyCheckoutSession);
router.post("/dev-activate", auth, devAutoActivate);
router.post("/verify-status", auth, verifyStatus);

export default router;
