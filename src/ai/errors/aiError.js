export class AiError extends Error {
  constructor(code, message, details = {}, statusCode = 500) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static disabled(message = "AI capabilities are currently disabled") {
    return new AiError("AI_DISABLED", message, {}, 503);
  }

  static providerUnavailable(provider, originalError = "") {
    return new AiError(
      "AI_PROVIDER_UNAVAILABLE",
      `AI Provider '${provider}' is temporarily unreachable`,
      { provider, originalError },
      503
    );
  }

  static timeout(timeoutMs) {
    return new AiError(
      "AI_TIMEOUT",
      `AI request timed out after ${timeoutMs}ms`,
      { timeoutMs },
      504
    );
  }

  static rateLimited(message = "AI request rate limit exceeded. Please try again shortly.") {
    return new AiError("AI_RATE_LIMITED", message, {}, 429);
  }

  static safetyViolation(reason) {
    return new AiError(
      "AI_SAFETY_VIOLATION",
      "Input or output rejected by AI safety policy",
      { reason },
      400
    );
  }

  static toolError(toolName, reason) {
    return new AiError(
      "AI_TOOL_ERROR",
      `Tool execution failed: ${toolName}`,
      { toolName, reason },
      500
    );
  }

  static unauthorizedTool(toolName, requiredRole) {
    return new AiError(
      "AI_TOOL_UNAUTHORIZED",
      `Unauthorized execution of tool '${toolName}'. Requires role: ${requiredRole}`,
      { toolName, requiredRole },
      403
    );
  }
}
