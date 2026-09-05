import { MCP_ERROR_CODES, McpError } from "./mcpErrors.js";

/**
 * Validates whether an incoming payload is a valid JSON-RPC 2.0 object.
 */
export function validateJsonRpcRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw McpError.invalidRequest("Payload must be a non-null JSON object");
  }

  if (payload.jsonrpc !== "2.0") {
    throw McpError.invalidRequest("Missing or invalid 'jsonrpc' field; expected '2.0'");
  }

  if (!payload.method || typeof payload.method !== "string") {
    throw McpError.invalidRequest("Missing or invalid 'method' field; expected a non-empty string");
  }

  return true;
}

/**
 * Checks if a message is a JSON-RPC 2.0 notification (has no 'id' field).
 */
export function isNotification(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    payload.jsonrpc === "2.0" &&
    typeof payload.method === "string" &&
    payload.id === undefined
  );
}

/**
 * Constructs a standard JSON-RPC 2.0 success response.
 */
export function createSuccessResponse(id, result = {}) {
  return {
    jsonrpc: "2.0",
    id: id !== undefined ? id : null,
    result,
  };
}

/**
 * Constructs a standard JSON-RPC 2.0 error response.
 */
export function createErrorResponse(id, err) {
  let code = MCP_ERROR_CODES.INTERNAL_ERROR;
  let message = "Internal error";
  let data = null;

  if (err instanceof McpError) {
    code = err.code;
    message = err.message;
    data = err.data;
  } else if (err && typeof err === "object") {
    code = err.code || MCP_ERROR_CODES.INTERNAL_ERROR;
    message = err.message || "Internal error";
    data = err.data || null;
  } else if (typeof err === "string") {
    message = err;
  }

  return {
    jsonrpc: "2.0",
    id: id !== undefined ? id : null,
    error: {
      code,
      message,
      ...(data !== null && data !== undefined ? { data } : {}),
    },
  };
}
