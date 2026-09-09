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
import {
  getAdminReviews,
  updateReviewStatus,
} from "../controllers/review.controller.js";
import {
  getAdminKnowledgeDocuments,
  createAdminKnowledgeDocument,
  getAdminKnowledgeDocumentById,
  updateAdminKnowledgeDocument,
  deleteAdminKnowledgeDocument,
  reindexAdminKnowledge,
} from "../controllers/knowledge.controller.js";
import {
  getAdminAppConfig,
  updateAdminAppConfig,
} from "../controllers/app_config.controller.js";


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

// 7. Review Moderation
router.get("/reviews", getAdminReviews);
router.patch("/reviews/:id/status", updateReviewStatus);

// 8. RAG Knowledge Management
router.get("/knowledge", getAdminKnowledgeDocuments);
router.post("/knowledge", createAdminKnowledgeDocument);
router.post("/knowledge/reindex", reindexAdminKnowledge);
router.get("/knowledge/:id", getAdminKnowledgeDocumentById);
router.patch("/knowledge/:id", updateAdminKnowledgeDocument);
router.delete("/knowledge/:id", deleteAdminKnowledgeDocument);

// 9. Remote App Configuration Management
router.get("/config", getAdminAppConfig);
router.patch("/config", updateAdminAppConfig);

export default router;

