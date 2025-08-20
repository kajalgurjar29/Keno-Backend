import express from "express";
import { changePassword 
} from "../controllers/Authentication/resetPassword.controller.js";

import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

router.post("/change-password/:id", verifyAPIKey, changePassword);

export default router;
