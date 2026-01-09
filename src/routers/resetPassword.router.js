import express from "express";
import { changePassword ,updatePin
} from "../controllers/Authentication/resetPassword.controller.js";

import verifyAPIKey from "../middleware/verifyAPIKey.js";
import verifyToken from "../middleware/auth.middleware.js";
const router = express.Router();

router.post("/change-password/:id", verifyAPIKey, changePassword);
router.post("/update-pin", verifyToken, updatePin);

export default router;
