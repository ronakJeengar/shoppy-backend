import { Router } from "express";
import { verifyJWT, requireRole } from "../middlewares/auth.middleware.js";
import {
  getOrderById,
  getUserOrders,
  cancelOrder,
  updateOrderStatus,
} from "../controllers/order.controller.js";

const router = Router();

// All order routes require authenticated user
router.use(verifyJWT);

router.route("/").get(getUserOrders);
router.route("/:id").get(getOrderById);
router.route("/:id/cancel").post(cancelOrder);

// Admin-only operational status transitions
router.route("/:id/status").patch(requireRole(["ADMIN"]), updateOrderStatus);

export default router;
