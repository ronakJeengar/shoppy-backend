import { AiError } from "../errors/aiError.js";

/**
 * Strips sensitive fields (passwords, tokens, payment secrets) from any tool output data.
 */
export function sanitizeToolOutput(data, depth = 0) {
  if (depth > 6 || data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  const SENSITIVE_KEYS = new Set([
    "password",
    "passwordhash",
    "refreshtoken",
    "accesstoken",
    "token",
    "secret",
    "secretkey",
    "signature",
    "paymentsignature",
    "razorpaysignature",
    "cvv",
    "pin",
    "otp",
    "salt",
  ]);

  if (Array.isArray(data)) {
    return data.slice(0, 50).map((item) => sanitizeToolOutput(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      continue; // redact sensitive key
    }
    sanitized[key] = sanitizeToolOutput(value, depth + 1);
  }
  return sanitized;
}

export class AITool {
  constructor({
    name,
    description,
    parameters = { type: "object", properties: {}, required: [] },
    outputSchema = {},
    requiresAuth = false,
    allowedRoles = ["CUSTOMER", "ADMIN"],
    sideEffectType = "READ_ONLY", // "READ_ONLY" | "WRITE" | "CONSEQUENTIAL"
    requiresConfirmation = false,
    timeout = 5000,
    rateLimit = null,
    idempotent = sideEffectType === "READ_ONLY",
    enabled = true,
  }) {
    if (!name) throw new Error("Tool must have a valid name");
    this.name = name;
    this.description = description;
    this.parameters = parameters;
    this.outputSchema = outputSchema;
    this.requiresAuth = requiresAuth;
    this.allowedRoles = allowedRoles;
    this.sideEffectType = sideEffectType;
    this.requiresConfirmation = requiresConfirmation || sideEffectType === "CONSEQUENTIAL";
    this.timeout = timeout;
    this.rateLimit = rateLimit;
    this.idempotent = idempotent;
    this.enabled = enabled;
  }

  /**
   * Validate tool inputs strictly against schema definitions.
   * Checks required fields, data types, string bounds, and allowed enums.
   */
  validateInput(args = {}) {
    if (typeof args !== "object" || args === null) {
      throw AiError.toolValidationError(this.name, "Arguments must be a valid JSON object");
    }

    const schemaProps = this.parameters.properties || {};
    const requiredProps = this.parameters.required || [];

    // Check required fields
    for (const reqField of requiredProps) {
      if (args[reqField] === undefined || args[reqField] === null || args[reqField] === "") {
        throw AiError.toolValidationError(this.name, `Missing required argument '${reqField}'`);
      }
    }

    // Validate parameter types and constraints
    for (const [key, val] of Object.entries(args)) {
      const propDef = schemaProps[key];
      if (!propDef) {
        // Unknown argument - allow if additionalProperties !== false, otherwise reject
        if (this.parameters.additionalProperties === false) {
          throw AiError.toolValidationError(this.name, `Unknown argument '${key}' not in schema`);
        }
        continue;
      }

      if (val === undefined || val === null) continue;

      if (propDef.type === "string") {
        if (typeof val !== "string") {
          throw AiError.toolValidationError(this.name, `Argument '${key}' must be a string`);
        }
        if (propDef.maxLength && val.length > propDef.maxLength) {
          throw AiError.toolValidationError(
            this.name,
            `Argument '${key}' exceeds max length of ${propDef.maxLength}`
          );
        }
        if (propDef.enum && !propDef.enum.includes(val)) {
          throw AiError.toolValidationError(
            this.name,
            `Argument '${key}' must be one of: ${propDef.enum.join(", ")}`
          );
        }
      } else if (propDef.type === "number" || propDef.type === "integer") {
        if (typeof val !== "number" || isNaN(val)) {
          throw AiError.toolValidationError(this.name, `Argument '${key}' must be a valid number`);
        }
        if (propDef.type === "integer" && !Number.isInteger(val)) {
          throw AiError.toolValidationError(this.name, `Argument '${key}' must be an integer`);
        }
        if (propDef.minimum !== undefined && val < propDef.minimum) {
          throw AiError.toolValidationError(
            this.name,
            `Argument '${key}' must be >= ${propDef.minimum}`
          );
        }
        if (propDef.maximum !== undefined && val > propDef.maximum) {
          throw AiError.toolValidationError(
            this.name,
            `Argument '${key}' must be <= ${propDef.maximum}`
          );
        }
      } else if (propDef.type === "boolean") {
        if (typeof val !== "boolean") {
          throw AiError.toolValidationError(this.name, `Argument '${key}' must be a boolean`);
        }
      } else if (propDef.type === "array") {
        if (!Array.isArray(val)) {
          throw AiError.toolValidationError(this.name, `Argument '${key}' must be an array`);
        }
      }
    }

    return true;
  }

  /**
   * Validates authorization, verifies input schemas, and enforces bounded timeout execution.
   * @param {Object} args
   * @param {Object} context
   * @param {Object} [context.user] - Authenticated user if available
   * @returns {Promise<Object>}
   */
  async run(args, context = {}) {
    if (!this.enabled) {
      throw AiError.toolError(this.name, `Tool '${this.name}' is currently disabled`);
    }

    // 1. Server-Side Authentication & Role Authorization
    if (this.requiresAuth && !context.user) {
      throw AiError.unauthorizedTool(this.name, this.allowedRoles.join(", "));
    }

    if (
      this.requiresAuth &&
      this.allowedRoles.length > 0 &&
      context.user &&
      !this.allowedRoles.includes(context.user.role)
    ) {
      throw AiError.unauthorizedTool(
        this.name,
        `User role '${context.user.role}' is not authorized. Required: ${this.allowedRoles.join(", ")}`
      );
    }

    // 2. Strict Input Schema Validation
    this.validateInput(args);

    // 3. Bounded Execution with Timeout (Promise.race)
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(AiError.toolTimeout(this.name, this.timeout));
      }, this.timeout);
    });

    try {
      const executionPromise = this.execute(args, context);
      const rawResult = await Promise.race([executionPromise, timeoutPromise]);
      clearTimeout(timeoutHandle);

      // 4. Sanitize Output Data Boundary
      return sanitizeToolOutput(rawResult);
    } catch (err) {
      clearTimeout(timeoutHandle);
      throw err;
    }
  }

  /**
   * Abstract execution method implemented by individual tools.
   */
  async execute(args, context) {
    throw new Error(`Execution not implemented for tool '${this.name}'`);
  }

  /**
   * Export standard JSON schema for LLM function calling and client inspection.
   */
  toJsonSchema() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      sideEffectType: this.sideEffectType,
      requiresConfirmation: this.requiresConfirmation,
    };
  }
}
