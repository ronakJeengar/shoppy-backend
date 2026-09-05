import { Router } from "express";
import { getAiHealth, queryAi } from "../controllers/ai.controller.js";
import { retrieveKnowledge } from "../controllers/knowledge.controller.js";
import { optionalJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// AI health check - reports subsystem readiness, provider and feature flags
router.get("/health", getAiHealth);

// AI query and conversational entry point with optional user authentication
router.post("/query", optionalJWT, queryAi);
router.post("/chat", optionalJWT, queryAi);

// RAG Knowledge retrieval endpoints
router.post("/knowledge/retrieve", optionalJWT, retrieveKnowledge);
router.get("/knowledge/search", optionalJWT, retrieveKnowledge);

export default router;

