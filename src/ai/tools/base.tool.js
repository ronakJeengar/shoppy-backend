import { AiError } from "../errors/aiError.js";

export class AITool {
  constructor({
    name,
    description,
    parameters = {},
    requiresAuth = false,
    allowedRoles = ["CUSTOMER", "ADMIN"],
  }) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
    this.requiresAuth = requiresAuth;
    this.allowedRoles = allowedRoles;
  }

  /**
   * Validate authorization and input parameters before executing.
   * @param {Object} args
   * @param {Object} context
   * @param {Object} [context.user] - Authenticated user if available
   * @returns {Promise<Object>}
   */
  async run(args, context = {}) {
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

    return await this.execute(args, context);
  }

  /**
   * Abstract execution method implemented by individual tools.
   */
  async execute(args, context) {
    throw new Error(`Execution not implemented for tool '${this.name}'`);
  }

  /**
   * Export standard JSON schema for LLM function calling.
   */
  toJsonSchema() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }
}
