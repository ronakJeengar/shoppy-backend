import { Router } from "express";
import { getAiHealth, queryAi } from "../controllers/ai.controller.js";
import {
  chatWithAssistant,
  getConversations,
  getConversationById,
  deleteConversation,
  clearConversationMessages,
  confirmPendingAction,
  cancelPendingAction,
} from "../controllers/conversation.controller.js";
import { retrieveKnowledge } from "../controllers/knowledge.controller.js";
import { optionalJWT, verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// AI health check - reports subsystem readiness, provider, and feature flags
router.get("/health", getAiHealth);

// AI one-off query endpoint (backward compatibility)
router.post("/query", optionalJWT, queryAi);

// Conversational AI Shopping Assistant endpoint
router.post("/chat", optionalJWT, chatWithAssistant);

// Action Confirmation & Consequential Operations (Phase 15)
router.post("/assistant/confirm", verifyJWT, confirmPendingAction);
router.post("/assistant/cancel-action", verifyJWT, cancelPendingAction);

// Conversation management endpoints
router.get("/conversations", verifyJWT, getConversations);
router.get("/conversations/:id", verifyJWT, getConversationById);
router.delete("/conversations/:id", verifyJWT, deleteConversation);
router.post("/conversations/:id/clear", verifyJWT, clearConversationMessages);

// RAG Knowledge retrieval endpoints
router.post("/knowledge/retrieve", optionalJWT, retrieveKnowledge);
router.get("/knowledge/search", optionalJWT, retrieveKnowledge);

export default router;
