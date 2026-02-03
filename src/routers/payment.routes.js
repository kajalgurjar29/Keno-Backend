import express from "express";
import { createCheckout } from "../controllers/payment/payment.controller.js";
import auth from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/checkout", auth, createCheckout);
router.post("/create-checkout", auth, createCheckout);
router.get("/create-checkout", auth, createCheckout); // Some frontend code might use GET
// router.post("/verify", auth, verifyPayment);

export default router;
