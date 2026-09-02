import { Router } from "express";
import { ApiResponse } from "../utils/apiResponse.js";
import authRouter from "./auth.routes.js";
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

// Backwards-compatibility aliases for legacy client endpoints
router.post("/signUp", registerUser);
router.post("/signIn", loginUser);
router.get("/currentUser", verifyJWT, getCurrentUser);

export default router;
