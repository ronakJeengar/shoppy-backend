import { Router } from "express";
import {
  getActiveFlashSales,
  getUpcomingFlashSales,
  getProductFlashSale,
  getFlashSaleById,
} from "../controllers/flashSale.controller.js";

const router = Router();

// Public discovery endpoints
router.get("/active", getActiveFlashSales);
router.get("/upcoming", getUpcomingFlashSales);
router.get("/product/:productId", getProductFlashSale);
router.get("/:id", getFlashSaleById);

export default router;
