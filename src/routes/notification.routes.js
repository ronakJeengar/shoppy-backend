import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  unregisterDeviceToken,
  getPreferences,
  updatePreferences,
} from "../controllers/notification.controller.js";

const router = Router();

// All notification endpoints require authentication
router.use(verifyJWT);

router.route("/").get(getNotifications);
router.route("/read-all").post(markAllAsRead);
router.route("/:id/read").patch(markAsRead);

router.route("/devices").post(registerDeviceToken);
router.route("/devices/:deviceToken").delete(unregisterDeviceToken);

router.route("/preferences").get(getPreferences).patch(updatePreferences);

export default router;
