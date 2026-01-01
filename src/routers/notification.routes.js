import express from "express";
import {
  sendNotification,
  getUserNotifications,
  markNotificationRead,
  markAllAsRead,
  getUnreadCount,
} from "../controllers/notification/notification.controller.js";

const router = express.Router();

router.post("/send", sendNotification);
router.get("/user/:userId", getUserNotifications);
router.get("/unread/:userId", getUnreadCount);
router.put("/:id/read", markNotificationRead);
router.put("/read-all/:userId", markAllAsRead);

export default router;
