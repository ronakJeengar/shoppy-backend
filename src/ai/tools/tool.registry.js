import { SearchProductsTool } from "./searchProducts.tool.js";
import { GetProductDetailsTool } from "./getProductDetails.tool.js";
import { GetUserOrderStatusTool } from "./getUserOrderStatus.tool.js";
import { CheckStorePolicyTool } from "./checkStorePolicy.tool.js";
import { AiError } from "../errors/aiError.js";

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  registerTool(tool) {
    if (!tool.name) throw new Error("Tool must have a valid name");
    this.tools.set(tool.name, tool);
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getAllToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * Returns schema definitions for tools that the current user context is authorized to see.
   */
  getAvailableToolDefinitions(context = {}) {
    const definitions = [];
    const isAuthenticated = !!context.user;
    const userRole = context.user?.role || "GUEST";

    for (const tool of this.tools.values()) {
      if (tool.requiresAuth && !isAuthenticated) {
        continue;
      }
      if (
        tool.requiresAuth &&
        tool.allowedRoles.length > 0 &&
        !tool.allowedRoles.includes(userRole)
      ) {
        continue;
      }
      definitions.push(tool.toJsonSchema());
    }

    return definitions;
  }

  /**
   * Safely execute an allowlisted tool with input validation and authorization checks.
   */
  async executeTool(name, args, context = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw AiError.toolError(name, `Tool '${name}' is not registered or allowlisted.`);
    }

    // Parse string arguments if received from LLM
    let parsedArgs = args;
    if (typeof args === "string") {
      try {
        parsedArgs = JSON.parse(args);
      } catch (err) {
        throw AiError.toolError(name, `Invalid JSON arguments provided: ${err.message}`);
      }
    }

    try {
      const result = await tool.run(parsedArgs || {}, context);
      return result;
    } catch (err) {
      throw AiError.toolError(name, err.message);
    }
  }
}

// Default registry populated with standard allowlisted tools
export const defaultToolRegistry = new ToolRegistry();
defaultToolRegistry.registerTool(new SearchProductsTool());
defaultToolRegistry.registerTool(new GetProductDetailsTool());
defaultToolRegistry.registerTool(new GetUserOrderStatusTool());
defaultToolRegistry.registerTool(new CheckStorePolicyTool());
