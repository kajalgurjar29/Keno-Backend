import express from "express";
import {
  requestPasswordReset,
  verifyOtp,
  setNewPassword,
   requestPinReset,
  verifyPinOtp,
  setNewPin,
} from "../controllers/Authentication/forgotPassword.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

router.post("/request-password-reset", verifyAPIKey, requestPasswordReset);
router.post("/otp-verification", verifyAPIKey, verifyOtp);
router.post("/set-new-password", verifyAPIKey, setNewPassword);
// pinReset 
router.post("/request-pin-reset", verifyAPIKey, requestPinReset);
router.post("/verify-pin-otp", verifyAPIKey, verifyPinOtp);
router.post("/set-new-pin", verifyAPIKey, setNewPin);
export default router;
