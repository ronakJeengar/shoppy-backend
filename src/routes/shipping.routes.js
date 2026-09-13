import { Router } from "express";
import {
  getServiceability,
  getShippingQuote,
  getAvailableShippingMethods,
} from "../controllers/shipping.controller.js";

const router = Router();

// Public: Check serviceability for a 6-digit Indian PIN code
router.get("/serviceability/:pinCode", getServiceability);

// Public: Calculate shipping quote
router.post("/quote", getShippingQuote);

// Public: Get available shipping methods and configurations
router.get("/methods", getAvailableShippingMethods);

export default router;
