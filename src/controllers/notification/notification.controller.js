import admin from "../../config/firebaseAdmin.js";
import Notification from "../../models/Notification.js";
import NotificationService from "../../services/NotificationService.js";

/* ======================================================
   1️⃣ SEND NOTIFICATION (Manual Push + Save in DB)
   POST /api/notification/send
====================================================== */
export const sendNotification = async (req, res) => {
  const { title, body, userId, category, priority, metadata } = req.body;

  if (!title || !body || !userId) {
    return res.status(400).json({
      success: false,
      message: "title, body, userId are required",
    });
  }

  try {
    // 🔔 Utilize the Robust Central Service
    await NotificationService.notifyUser({
      userId,
      title,
      body,
      category: category || "activity",
      priority: priority || "medium",
      metadata: metadata || {}
    });

    res.status(200).json({
      success: true,
      message: "Notification processing triggered",
    });
  } catch (error) {
    console.error("Manual Notification Error:", error);
    res.status(500).json({
      success: false,
      message: "Notification failed",
      error: error.message,
    });
  }
};


export const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};


export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    await Notification.findByIdAndUpdate(id, {
      isRead: true,
    });

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

/* ======================================================
   4️⃣ MARK ALL AS READ (Bell open)
   PUT /api/notification/read-all/:userId
====================================================== */
export const markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to mark all as read",
    });
  }
};

/* ======================================================
   5️⃣ UNREAD COUNT (Bell badge 🔔)
   GET /api/notification/unread/:userId
====================================================== */
export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const count = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
    });
  }
};
