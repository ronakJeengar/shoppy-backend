import mongoose from "mongoose";
import { AuditLog } from "../models/audit_log.model.js";

// In-memory store for offline/testing mode
export const memoryAuditLogs = [];

const SENSITIVE_KEYS = [
  "password",
  "currentPassword",
  "newPassword",
  "accessToken",
  "refreshToken",
  "secret",
  "clientSecret",
  "token",
];

const sanitizeDetails = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeDetails(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export const logAdminAction = async ({
  req,
  action,
  resourceType,
  resourceId,
  details = {},
}) => {
  try {
    const adminId = req?.user?._id || "64f1a2b3c4d5e6f7a8b9c001";
    const adminEmail = req?.user?.email || "admin@example.com";
    const ipAddress =
      req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "";

    const cleanedDetails = sanitizeDetails(details);

    if (mongoose.connection.readyState === 1) {
      await AuditLog.create({
        action,
        admin: adminId,
        adminEmail,
        resourceType,
        resourceId: resourceId ? resourceId.toString() : "N/A",
        details: cleanedDetails,
        ipAddress,
      });
    } else {
      memoryAuditLogs.unshift({
        _id: new mongoose.Types.ObjectId().toString(),
        action,
        admin: adminId.toString(),
        adminEmail,
        resourceType,
        resourceId: resourceId ? resourceId.toString() : "N/A",
        details: cleanedDetails,
        ipAddress,
        createdAt: new Date(),
      });
      if (memoryAuditLogs.length > 200) {
        memoryAuditLogs.pop();
      }
    }
  } catch (err) {
    console.error("Failed to record audit log:", err.message);
  }
};
