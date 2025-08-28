import express from "express";
import {
  getUserData,
  updateUserData,
  getAllUsers,
} from "../controllers/Authentication/ProfileManagement.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";
const router = express.Router();

router.get("/user/:id", verifyAPIKey, getUserData);
router.put("/user/update/:id", verifyAPIKey, updateUserData);
router.get("/users", verifyAPIKey, getAllUsers);

export default router;
