import { Router } from "express";
import { getAiHealth, queryAi } from "../controllers/ai.controller.js";
import { optionalJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// AI health check - reports subsystem readiness, provider and feature flags
router.get("/health", getAiHealth);

// AI query and conversational entry point with optional user authentication
router.post("/query", optionalJWT, queryAi);
router.post("/chat", optionalJWT, queryAi);

export default router;
