import { Router } from "express";
import {
  validateCoupon,
  getAvailableCoupons,
} from "../controllers/coupon.controller.js";
import { optionalJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/validate", optionalJWT, validateCoupon);
router.get("/available", getAvailableCoupons);

export default router;
