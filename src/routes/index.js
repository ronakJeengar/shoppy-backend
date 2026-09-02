import { Router } from "express";
import { ApiResponse } from "../utils/apiResponse.js";

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

export default router;
