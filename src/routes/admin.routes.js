import { Router } from "express";
import { verifyJWT, requireRole } from "../middlewares/auth.middleware.js";
import {
  getDashboardMetrics,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  updateAdminStock,
  deleteAdminProduct,
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  getAdminUsers,
  getAdminUserById,
  updateAdminUserStatus,
  updateAdminUserRole,
  getAdminAuditLogs,
} from "../controllers/admin.controller.js";

const router = Router();

// Strict security: all admin routes require authenticated JWT and ADMIN role
router.use(verifyJWT);
router.use(requireRole(["ADMIN"]));

// 1. Dashboard
router.get("/dashboard", getDashboardMetrics);

// 2. Product & Inventory Management
router.get("/products", getAdminProducts);
router.post("/products", createAdminProduct);
router.patch("/products/:id", updateAdminProduct);
router.patch("/products/:id/stock", updateAdminStock);
router.delete("/products/:id", deleteAdminProduct);

// 3. Category Management
router.get("/categories", getAdminCategories);
router.post("/categories", createAdminCategory);
router.patch("/categories/:id", updateAdminCategory);
router.delete("/categories/:id", deleteAdminCategory);

// 4. Order Management
router.get("/orders", getAdminOrders);
router.get("/orders/:id", getAdminOrderById);
router.patch("/orders/:id/status", updateAdminOrderStatus);

// 5. User Management
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserById);
router.patch("/users/:id/status", updateAdminUserStatus);
router.patch("/users/:id/role", updateAdminUserRole);

// 6. Audit Logging
router.get("/audit-logs", getAdminAuditLogs);

export default router;
