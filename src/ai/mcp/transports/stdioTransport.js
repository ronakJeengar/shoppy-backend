import readline from "readline";
import { defaultMcpServer } from "../server/mcpServer.js";
import { createErrorResponse } from "../protocol/jsonRpc.js";
import { McpError } from "../protocol/mcpErrors.js";

/**
 * Starts an MCP Standard I/O (stdio) transport listener.
 * Processes line-delimited JSON-RPC messages from stdin and outputs to stdout.
 */
export function startStdioServer({
  server = defaultMcpServer,
  stdin = process.stdin,
  stdout = process.stdout,
  context = {},
} = {}) {
  const rl = readline.createInterface({
    input: stdin,
    output: null,
    terminal: false,
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message;
    try {
      message = JSON.parse(trimmed);
    } catch (err) {
      const errResponse = createErrorResponse(null, McpError.parseError("Malformed JSON input"));
      stdout.write(JSON.stringify(errResponse) + "\n");
      return;
    }

    try {
      const response = await server.handleRequest(message, {
        ...context,
        transport: "stdio",
      });

      if (response !== null) {
        stdout.write(JSON.stringify(response) + "\n");
      }
    } catch (unexpectedErr) {
      const errResponse = createErrorResponse(
        message?.id,
        McpError.internalError(unexpectedErr.message)
      );
      stdout.write(JSON.stringify(errResponse) + "\n");
    }
  });

  return rl;
}
