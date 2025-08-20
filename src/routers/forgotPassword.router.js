import express from "express";
import {
  requestPasswordReset,
  resetPassword,
} from "../controllers/Authentication/forgotPassword.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";
const router = express.Router();


router.post("/request-password-reset",verifyAPIKey, requestPasswordReset);
router.post("/reset-password",verifyAPIKey, resetPassword);

export default router;
