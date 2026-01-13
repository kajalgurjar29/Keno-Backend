import express from "express";
import {
  registerUser,
  verifyOtp,
  setPassword,
  loginUser,
  saveFcmToken,
} from "../controllers/Authentication/UserRegister.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";
import auth from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/set-password", setPassword);
router.post("/login", loginUser);

// 🔔 FIXED ROUTE (VERY IMPORTANT)
router.post("/save-fcm-token", auth, saveFcmToken);

export default router;
