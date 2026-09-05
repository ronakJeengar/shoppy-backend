import crypto from "crypto";
import { defaultMcpServer } from "../server/mcpServer.js";
import { mcpConfig } from "../config/mcp.config.js";
import { isFeatureEnabled } from "../../config/ai.config.js";

/**
 * Middleware supporting MCP API Key authentication via header or query param.
 */
export function mcpApiKeyAuth(req, res, next) {
  const apiKey = req.header("x-mcp-api-key") || req.query.apiKey;

  if (apiKey && apiKey === mcpConfig.apiKey && !req.user) {
    req.user = {
      _id: "mcp_service_agent_id",
      email: "mcp-agent@shoppy.local",
      fullName: "MCP Service Agent",
      role: "CUSTOMER",
    };
  }
  next();
}

/**
 * HTTP Transport handler for JSON-RPC 2.0 messages (POST /api/v1/mcp).
 */
export async function handleMcpMessage(req, res) {
  if (!isFeatureEnabled("mcpEnabled")) {
    return res.status(503).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32000,
        message: "MCP capabilities are currently disabled",
      },
    });
  }

  const context = {
    user: req.user || null,
    ip: req.ip || req.connection?.remoteAddress,
    headers: req.headers,
    transport: "http",
  };

  const response = await defaultMcpServer.handleRequest(req.body, context);

  if (response === null) {
    // Notifications yield 204 No Content
    return res.status(204).end();
  }

  return res.status(200).json(response);
}

/**
 * SSE Transport handler (GET /api/v1/mcp/sse).
 * Emits the endpoint URL and maintains connection for streaming notifications.
 */
export function handleMcpSse(req, res) {
  if (!isFeatureEnabled("mcpEnabled")) {
    return res.status(503).json({
      success: false,
      statusCode: 503,
      message: "MCP capabilities are currently disabled",
    });
  }

  const sessionId = crypto.randomBytes(16).toString("hex");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Send initial endpoint event following MCP SSE protocol
  res.write(`event: endpoint\ndata: /api/v1/mcp?sessionId=${sessionId}\n\n`);

  // Keep-alive heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
  });
}
