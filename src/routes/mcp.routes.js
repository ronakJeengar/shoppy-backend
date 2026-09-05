import { Router } from "express";
import { optionalJWT } from "../middlewares/auth.middleware.js";
import {
  handleMcpMessage,
  handleMcpSse,
  mcpApiKeyAuth,
} from "../ai/mcp/transports/httpTransport.js";

const router = Router();

// POST /api/v1/mcp - Standard JSON-RPC 2.0 message handler
router.post("/", optionalJWT, mcpApiKeyAuth, handleMcpMessage);

// GET /api/v1/mcp/sse - Server-Sent Events stream
router.get("/sse", optionalJWT, mcpApiKeyAuth, handleMcpSse);

export default router;
