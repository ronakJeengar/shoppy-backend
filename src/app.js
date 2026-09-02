import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import apiRouter from "./routes/index.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { ApiError } from "./utils/apiError.js";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(express.static("public"));

// Health check endpoint at root level
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Shoppy backend server is running",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount versioned API routes
app.use("/api/v1", apiRouter);

// Catch-all 404 handler for unknown routes
app.use((req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
});

// Centralized error handling middleware
app.use(errorMiddleware);

export default app;