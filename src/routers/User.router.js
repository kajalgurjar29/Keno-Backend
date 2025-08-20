import express from "express";
import {
  registerUser,
  verifyOtp,
  setPassword,
  loginUser,
} from "../controllers/Authentication/UserRegister.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

router.post("/register", verifyAPIKey, registerUser);
router.post("/verify-otp", verifyAPIKey, verifyOtp);
router.post("/set-password",verifyAPIKey, setPassword);
router.post("/login", verifyAPIKey, loginUser);

export default router;