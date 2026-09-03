import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  validateCheckout,
  createOrderFromCheckout,
} from "../controllers/checkout.controller.js";

const router = Router();

// Checkout routes require authenticated user
router.use(verifyJWT);

router.route("/validate").post(validateCheckout);
router.route("/create").post(createOrderFromCheckout);

export default router;
