import { Router } from "express";
import { ApiResponse } from "../utils/apiResponse.js";
import authRouter from "./auth.routes.js";
import categoryRouter from "./category.routes.js";
import productRouter from "./product.routes.js";
import cartRouter from "./cart.routes.js";
import wishlistRouter from "./wishlist.routes.js";
import addressRouter from "./address.routes.js";
import checkoutRouter from "./checkout.routes.js";
import paymentRouter from "./payment.routes.js";
import orderRouter from "./order.routes.js";
import notificationRouter from "./notification.routes.js";
import adminRouter from "./admin.routes.js";
import reviewRouter from "./review.routes.js";
import aiRouter from "./ai.routes.js";
import {
  registerUser,
  loginUser,
  getCurrentUser,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Health check endpoint
router.get("/health", (req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      },
      "Shoppy API service is operational"
    )
  );
});

// Authentication module
router.use("/auth", authRouter);

// Product Catalog & Categories modules
router.use("/categories", categoryRouter);
router.use("/products", productRouter);

// Cart & Wishlist modules
router.use("/cart", cartRouter);
router.use("/wishlist", wishlistRouter);

// Checkout & Payment modules
router.use("/addresses", addressRouter);
router.use("/checkout", checkoutRouter);
router.use("/payments", paymentRouter);
router.use("/orders", orderRouter);
router.use("/notifications", notificationRouter);
router.use("/admin", adminRouter);
router.use(reviewRouter);
router.use("/ai", aiRouter);

// Backwards-compatibility aliases for legacy client endpoints
router.post("/signUp", registerUser);
router.post("/signIn", loginUser);
router.get("/currentUser", verifyJWT, getCurrentUser);

export default router;
