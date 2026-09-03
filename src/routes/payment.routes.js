import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  verifyPayment,
  failPayment,
  handlePaymentWebhook,
  getPaymentDetails,
} from "../controllers/payment.controller.js";

const router = Router();

// Public webhook endpoint (verified via HMAC signature)
router.post("/webhook", handlePaymentWebhook);

// Protected routes require authenticated user
router.use(verifyJWT);

router.post("/verify", verifyPayment);
router.post("/fail", failPayment);
router.get("/:transactionId", getPaymentDetails);

export default router;
