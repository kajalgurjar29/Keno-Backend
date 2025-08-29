import express from "express";
import {
  getUserData,
  updateUserData,
  getAllUsers,
  changeUserStatus,
} from "../controllers/Authentication/ProfileManagement.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";
const router = express.Router();

router.get("/user/:id", verifyAPIKey, getUserData);
router.put("/user/update/:id", verifyAPIKey, updateUserData);
router.get("/users", verifyAPIKey, getAllUsers);
router.patch("/status/:id", verifyAPIKey, changeUserStatus);

export default router;
