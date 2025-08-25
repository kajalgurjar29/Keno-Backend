import express from "express";
import {
  requestPasswordReset,
  verifyOtp,
  setNewPassword,
} from "../controllers/Authentication/forgotPassword.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

router.post("/request-password-reset", verifyAPIKey, requestPasswordReset);
router.post("/otp-verification", verifyAPIKey, verifyOtp);
router.post("/set-new-password", verifyAPIKey, setNewPassword);

export default router;
