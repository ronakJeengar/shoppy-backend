import mongoose from "mongoose";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";

// Offline fallback store for test runs
const inMemoryNotifications = new Map();

export const createTransactionalNotification = async ({
  userId,
  type = "SYSTEM",
  title,
  body,
  data = {},
}) => {
  if (!userId || !title || !body) return null;

  try {
    const userStr = userId.toString();

    // Check user preferences if available
    let orderUpdatesEnabled = true;
    let promotionsEnabled = true;

    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(userId);
      if (user?.notificationPreferences) {
        orderUpdatesEnabled = user.notificationPreferences.orderUpdates !== false;
        promotionsEnabled = user.notificationPreferences.promotions !== false;
      }

      if (type.startsWith("ORDER_") && !orderUpdatesEnabled) {
        return null;
      }
      if (type === "PROMOTION" && !promotionsEnabled) {
        return null;
      }

      const notif = await Notification.create({
        user: userId,
        type,
        title,
        body,
        data,
      });

      return notif;
    }

    // Offline mode
    if (type.startsWith("ORDER_") && !orderUpdatesEnabled) {
      return null;
    }

    const userNotifs = inMemoryNotifications.get(userStr) || [];
    const offlineNotif = {
      _id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user: userStr,
      type,
      title,
      body,
      data,
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };

    userNotifs.unshift(offlineNotif);
    inMemoryNotifications.set(userStr, userNotifs);

    return offlineNotif;
  } catch (error) {
    // Transactional notification failure must NOT break the parent business operation
    console.error("Error creating notification (swallowed safely):", error.message);
    return null;
  }
};

export const _getInMemoryNotifications = (userId) => {
  return inMemoryNotifications.get(userId.toString()) || [];
};

export const _registerTestNotification = (notif) => {
  const userId = notif.user.toString();
  const list = inMemoryNotifications.get(userId) || [];
  list.unshift(notif);
  inMemoryNotifications.set(userId, list);
};

export const _clearTestNotifications = () => {
  inMemoryNotifications.clear();
};
