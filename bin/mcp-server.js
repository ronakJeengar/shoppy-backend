#!/usr/bin/env node

/**
 * Shoppy MCP Server — CLI Standalone Executable (stdio transport)
 *
 * Usage with Claude Desktop / Cursor:
 * {
 *   "mcpServers": {
 *     "shoppy": {
 *       "command": "node",
 *       "args": ["/absolute/path/to/shoppy-backend/bin/mcp-server.js"]
 *     }
 *   }
 * }
 */

import "../src/utils/nodePolyfill.js";
import { startStdioServer } from "../src/ai/mcp/transports/stdioTransport.js";
import { defaultMcpServer } from "../src/ai/mcp/server/mcpServer.js";

const args = process.argv.slice(2);
let userId = process.env.MCP_USER_ID || null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--user-id" && args[i + 1]) {
    userId = args[i + 1];
    i++;
  }
}

const context = {
  user: userId
    ? {
        _id: userId,
        role: "CUSTOMER",
        fullName: "MCP Local User",
      }
    : null,
};

// Start stdio transport
startStdioServer({
  server: defaultMcpServer,
  context,
});

process.stderr.write(
  `[Shoppy MCP Server] Running stdio transport (Protocol: 2024-11-05). Ready for JSON-RPC 2.0 messages.\n`
);
