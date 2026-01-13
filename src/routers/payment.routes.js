import express from "express";
import { createCheckout, verifyPayment } from "../controllers/payment/payment.controller.js";
import auth from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/checkout", auth, createCheckout);
router.post("/verify", auth, verifyPayment);

export default router;
