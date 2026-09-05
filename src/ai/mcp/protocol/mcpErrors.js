/**
 * Standard JSON-RPC 2.0 and MCP Application Error Codes
 */
export const MCP_ERROR_CODES = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // MCP Application-defined errors
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32003,
  RESOURCE_NOT_FOUND: -32004,
  TOOL_EXECUTION_ERROR: -32005,
  RATE_LIMITED: -32029,
};

export class McpError extends Error {
  constructor(code, message, data = null) {
    super(message);
    this.name = "McpError";
    this.code = code;
    this.data = data;
  }

  static parseError(details = "Invalid JSON payload") {
    return new McpError(MCP_ERROR_CODES.PARSE_ERROR, "Parse error", details);
  }

  static invalidRequest(details = "Request is not a valid JSON-RPC 2.0 request") {
    return new McpError(MCP_ERROR_CODES.INVALID_REQUEST, "Invalid Request", details);
  }

  static methodNotFound(method) {
    return new McpError(
      MCP_ERROR_CODES.METHOD_NOT_FOUND,
      `Method '${method}' is not supported by Shoppy MCP Server`
    );
  }

  static invalidParams(details = "Invalid parameters provided") {
    return new McpError(MCP_ERROR_CODES.INVALID_PARAMS, "Invalid params", details);
  }

  static internalError(details = "An internal error occurred during execution") {
    return new McpError(MCP_ERROR_CODES.INTERNAL_ERROR, "Internal error", details);
  }

  static unauthorized(details = "Authentication required to invoke this tool or resource") {
    return new McpError(MCP_ERROR_CODES.UNAUTHORIZED, "Unauthorized", details);
  }

  static forbidden(details = "Access denied: insufficient permissions or cross-tenant IDOR violation") {
    return new McpError(MCP_ERROR_CODES.FORBIDDEN, "Forbidden", details);
  }

  static resourceNotFound(uri) {
    return new McpError(
      MCP_ERROR_CODES.RESOURCE_NOT_FOUND,
      `Resource '${uri}' not found`,
      { uri }
    );
  }

  static toolError(toolName, details) {
    return new McpError(
      MCP_ERROR_CODES.TOOL_EXECUTION_ERROR,
      `Tool '${toolName}' execution failed: ${details}`,
      { toolName }
    );
  }

  static rateLimited(details = "Rate limit exceeded. Please throttle your requests.") {
    return new McpError(MCP_ERROR_CODES.RATE_LIMITED, "Rate limit exceeded", details);
  }
}
