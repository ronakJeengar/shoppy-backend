/**
 * Model Context Protocol (MCP) Configuration
 * Specification Version: 2024-11-05
 */
export const mcpConfig = {
  enabled: process.env.MCP_ENABLED !== "false",
  protocolVersion: "2024-11-05",
  serverInfo: {
    name: "shoppy-mcp-server",
    version: "1.0.0",
    description:
      "Authoritative Model Context Protocol (MCP) server for Shoppy e-commerce platform.",
  },
  defaultTimeoutMs: 5000,
  maxPayloadBytes: 512 * 1024, // 512 KB
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 120, // 120 requests/minute
  },
  allowedTransports: ["http", "sse", "stdio"],
  apiKey: process.env.MCP_API_KEY || "shoppy_mcp_dev_key_2026",
};
