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
  getAdminCoupons,
  createAdminCoupon,
  getAdminCouponById,
  updateAdminCoupon,
  toggleAdminCouponStatus,
  deleteAdminCoupon,
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
import {
  getAdminCampaigns,
  createAdminCampaign,
  getAdminCampaignById,
  updateAdminCampaign,
  toggleAdminCampaignStatus,
  deleteAdminCampaign,
} from "../controllers/campaign.controller.js";
import {
  getAdminFlashSales,
  createAdminFlashSale,
  getAdminFlashSaleById,
  updateAdminFlashSale,
  toggleAdminFlashSaleStatus,
  deleteAdminFlashSale,
} from "../controllers/flashSale.controller.js";
import {
  getAdminPostalCodes,
  upsertAdminPostalCode,
  deleteAdminPostalCode,
} from "../controllers/shipping.controller.js";
import {
  getAdminCodConfig,
  updateAdminCodConfig,
  updateUserCodBlockStatus,
} from "../controllers/cod.controller.js";
import { getAdminInvoices } from "../controllers/invoice.controller.js";

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

// 10. Coupon & Promotion Management
router.get("/coupons", getAdminCoupons);
router.post("/coupons", createAdminCoupon);
router.get("/coupons/:id", getAdminCouponById);
router.patch("/coupons/:id", updateAdminCoupon);
router.patch("/coupons/:id/status", toggleAdminCouponStatus);
router.delete("/coupons/:id", deleteAdminCoupon);

// 11. Campaign & Sale Banner Management
router.get("/campaigns", getAdminCampaigns);
router.post("/campaigns", createAdminCampaign);
router.get("/campaigns/:id", getAdminCampaignById);
router.patch("/campaigns/:id", updateAdminCampaign);
router.patch("/campaigns/:id/status", toggleAdminCampaignStatus);
router.delete("/campaigns/:id", deleteAdminCampaign);

// 12. Flash Sale & Lightning Deals Management
router.get("/flash-sales", getAdminFlashSales);
router.post("/flash-sales", createAdminFlashSale);
router.get("/flash-sales/:id", getAdminFlashSaleById);
router.patch("/flash-sales/:id", updateAdminFlashSale);
router.patch("/flash-sales/:id/status", toggleAdminFlashSaleStatus);
router.delete("/flash-sales/:id", deleteAdminFlashSale);

// 13. Indian Shipping & PIN Serviceability Management
router.get("/shipping/postal-codes", getAdminPostalCodes);
router.post("/shipping/postal-codes", upsertAdminPostalCode);
router.delete("/shipping/postal-codes/:id", deleteAdminPostalCode);

// 14. Cash on Delivery (COD) Management
router.get("/cod/config", getAdminCodConfig);
router.patch("/cod/config", updateAdminCodConfig);
router.patch("/users/:id/cod-block", updateUserCodBlockStatus);

// 15. GST Invoice Management
router.get("/invoices", getAdminInvoices);

export default router;

