import mongoose from "mongoose";
import { Notification } from "../models/notification.model.js";
import { DeviceToken } from "../models/device_token.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  _getInMemoryNotifications,
  _registerTestNotification,
  _clearTestNotifications,
} from "../utils/notificationService.js";

// In-memory device tokens and preferences fallback for test runs
const inMemoryDeviceTokens = new Map();
const inMemoryPreferences = new Map();

export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  if (mongoose.connection.readyState === 1) {
    const totalNotifications = await Notification.countDocuments({
      user: req.user._id,
    });
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });

    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalNotifications / limit) || 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          notifications,
          unreadCount,
          page,
          limit,
          totalNotifications,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        "Notifications retrieved successfully"
      )
    );
  }

  // Offline fallback
  const userNotifs = _getInMemoryNotifications(userId);
  const unreadCount = userNotifs.filter((n) => !n.isRead).length;
  const paginated = userNotifs.slice(skip, skip + limit);
  const totalNotifications = userNotifs.length;
  const totalPages = Math.ceil(totalNotifications / limit) || 1;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        notifications: paginated,
        unreadCount,
        page,
        limit,
        totalNotifications,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      "Notifications retrieved successfully"
    )
  );
});

export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id.toString();

  if (mongoose.connection.readyState === 1) {
    const notification = await Notification.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      throw new ApiError(404, "Notification not found or unauthorized");
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          notification,
          "Notification marked as read successfully"
        )
      );
  }

  // Offline fallback
  const userNotifs = _getInMemoryNotifications(userId);
  const notif = userNotifs.find((n) => n._id.toString() === id);
  if (!notif) {
    throw new ApiError(404, "Notification not found or unauthorized");
  }

  notif.isRead = true;
  notif.readAt = new Date();

  return res
    .status(200)
    .json(
      new ApiResponse(200, notif, "Notification marked as read successfully")
    );
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  if (mongoose.connection.readyState === 1) {
    const result = await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { modifiedCount: result.modifiedCount },
          "All notifications marked as read"
        )
      );
  }

  // Offline fallback
  const userNotifs = _getInMemoryNotifications(userId);
  let count = 0;
  for (const n of userNotifs) {
    if (!n.isRead) {
      n.isRead = true;
      n.readAt = new Date();
      count++;
    }
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { modifiedCount: count },
        "All notifications marked as read"
      )
    );
});

export const registerDeviceToken = asyncHandler(async (req, res) => {
  const { deviceToken, platform } = req.body;
  const userId = req.user._id.toString();

  if (!deviceToken || !deviceToken.trim()) {
    throw new ApiError(400, "Device token is required");
  }

  const cleanToken = deviceToken.trim();
  const validPlatform = ["ANDROID", "IOS", "WEB"].includes(platform)
    ? platform
    : "ANDROID";

  if (mongoose.connection.readyState === 1) {
    const tokenDoc = await DeviceToken.findOneAndUpdate(
      { deviceToken: cleanToken },
      {
        user: req.user._id,
        deviceToken: cleanToken,
        platform: validPlatform,
        isActive: true,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          tokenDoc,
          "Device token registered successfully"
        )
      );
  }

  // Offline fallback
  const userTokens = inMemoryDeviceTokens.get(userId) || [];
  const existingIdx = userTokens.findIndex((t) => t.deviceToken === cleanToken);
  const tokenRecord = {
    _id: `dt_${Date.now()}`,
    user: userId,
    deviceToken: cleanToken,
    platform: validPlatform,
    isActive: true,
    lastSeenAt: new Date(),
  };

  if (existingIdx !== -1) {
    userTokens[existingIdx] = tokenRecord;
  } else {
    userTokens.push(tokenRecord);
  }
  inMemoryDeviceTokens.set(userId, userTokens);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        tokenRecord,
        "Device token registered successfully"
      )
    );
});

export const unregisterDeviceToken = asyncHandler(async (req, res) => {
  const { deviceToken } = req.params;
  const userId = req.user._id.toString();

  if (!deviceToken) {
    throw new ApiError(400, "Device token parameter is required");
  }

  if (mongoose.connection.readyState === 1) {
    await DeviceToken.findOneAndDelete({
      deviceToken,
      user: req.user._id,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, null, "Device token unregistered successfully")
      );
  }

  // Offline fallback
  const userTokens = inMemoryDeviceTokens.get(userId) || [];
  const updatedTokens = userTokens.filter((t) => t.deviceToken !== deviceToken);
  inMemoryDeviceTokens.set(userId, updatedTokens);

  return res
    .status(200)
    .json(
      new ApiResponse(200, null, "Device token unregistered successfully")
    );
});

export const getPreferences = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  if (mongoose.connection.readyState === 1) {
    const user = await User.findById(req.user._id);
    const prefs = user?.notificationPreferences || {
      orderUpdates: true,
      promotions: true,
      wishlistAlerts: true,
    };
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          prefs,
          "Notification preferences retrieved successfully"
        )
      );
  }

  // Offline fallback
  const prefs = inMemoryPreferences.get(userId) || {
    orderUpdates: true,
    promotions: true,
    wishlistAlerts: true,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        prefs,
        "Notification preferences retrieved successfully"
      )
    );
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { orderUpdates, promotions, wishlistAlerts } = req.body;

  if (mongoose.connection.readyState === 1) {
    const user = await User.findById(req.user._id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (!user.notificationPreferences) {
      user.notificationPreferences = {
        orderUpdates: true,
        promotions: true,
        wishlistAlerts: true,
      };
    }

    if (orderUpdates !== undefined)
      user.notificationPreferences.orderUpdates = Boolean(orderUpdates);
    if (promotions !== undefined)
      user.notificationPreferences.promotions = Boolean(promotions);
    if (wishlistAlerts !== undefined)
      user.notificationPreferences.wishlistAlerts = Boolean(wishlistAlerts);

    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          user.notificationPreferences,
          "Notification preferences updated successfully"
        )
      );
  }

  // Offline fallback
  const prefs = inMemoryPreferences.get(userId) || {
    orderUpdates: true,
    promotions: true,
    wishlistAlerts: true,
  };

  if (orderUpdates !== undefined) prefs.orderUpdates = Boolean(orderUpdates);
  if (promotions !== undefined) prefs.promotions = Boolean(promotions);
  if (wishlistAlerts !== undefined) prefs.wishlistAlerts = Boolean(wishlistAlerts);

  inMemoryPreferences.set(userId, prefs);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        prefs,
        "Notification preferences updated successfully"
      )
    );
});

export const _clearNotificationState = () => {
  _clearTestNotifications();
  inMemoryDeviceTokens.clear();
  inMemoryPreferences.clear();
};
