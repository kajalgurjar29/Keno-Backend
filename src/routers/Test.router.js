import express from "express";
import { testSendGridEmail } from "../controllers/Test/EmailTest.controller.js";
import verifyAPIKey from "../middleware/verifyAPIKey.js";

const router = express.Router();

router.post("/test-email", verifyAPIKey, testSendGridEmail);

export default router;
