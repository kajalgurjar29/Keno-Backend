import express from "express";
import {
  registerUser,
  verifyOtp,
  setPassword,
  loginUser,
  logoutUser,
  saveFcmToken,
  deleteAccount,
} from "../controllers/Authentication/UserRegister.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";
import auth from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", verifyAPIKey, registerUser);
router.post("/verify-otp", verifyAPIKey, verifyOtp);
router.post("/set-password", verifyAPIKey, setPassword);
router.post("/login", verifyAPIKey, loginUser);
router.post("/logout", auth, logoutUser);
router.delete("/delete-account", auth, deleteAccount);

//  FIXED ROUTE (VERY IMPORTANT)
router.post("/save-fcm-token", auth, saveFcmToken);


export default router;
