import { SearchProductsTool } from "./searchProducts.tool.js";
import { SemanticProductSearchTool } from "./semanticProductSearch.tool.js";
import { GetProductDetailsTool } from "./getProductDetails.tool.js";
import { CheckProductAvailabilityTool } from "./checkProductAvailability.tool.js";
import { GetUserOrderStatusTool } from "./getUserOrderStatus.tool.js";
import { CheckStorePolicyTool } from "./checkStorePolicy.tool.js";
import { SearchKnowledgeTool } from "./searchKnowledge.tool.js";
import { GetCartTool } from "./getCart.tool.js";
import { AddToCartTool } from "./addToCart.tool.js";
import { RemoveFromCartTool } from "./removeFromCart.tool.js";
import { UpdateCartQuantityTool } from "./updateCartQuantity.tool.js";
import { AddToWishlistTool } from "./addToWishlist.tool.js";
import { RemoveFromWishlistTool } from "./removeFromWishlist.tool.js";
import { GetUserOrdersTool } from "./getUserOrders.tool.js";
import { GetOrderDetailsTool } from "./getOrderDetails.tool.js";
import { GetUserProfileTool } from "./getUserProfile.tool.js";
import { CancelOrderTool } from "./cancelOrder.tool.js";
import { AiError } from "../errors/aiError.js";

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  registerTool(tool) {
    if (!tool || !tool.name) throw new Error("Tool must have a valid name");
    this.tools.set(tool.name, tool);
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getAllToolNames() {
    return Array.from(this.tools.keys());
  }

  getToolsBySideEffectType(sideEffectType) {
    return Array.from(this.tools.values()).filter(
      (t) => t.sideEffectType === sideEffectType
    );
  }

  /**
   * Returns schema definitions for tools that the current user context is authorized to see.
   */
  getAvailableToolDefinitions(context = {}) {
    const definitions = [];
    const isAuthenticated = !!context.user;
    const userRole = context.user?.role || "GUEST";

    for (const tool of this.tools.values()) {
      if (!tool.enabled) continue;

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
   * Safely execute an allowlisted tool with input validation, authorization, and timeout bounds.
   */
  async executeTool(name, args, context = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw AiError.toolError(name, `Tool '${name}' is not registered or allowlisted.`);
    }

    if (!tool.enabled) {
      throw AiError.toolError(name, `Tool '${name}' is currently disabled.`);
    }

    // Parse string arguments if received from LLM
    let parsedArgs = args;
    if (typeof args === "string") {
      try {
        parsedArgs = JSON.parse(args);
      } catch (err) {
        throw AiError.toolValidationError(name, `Invalid JSON arguments provided: ${err.message}`);
      }
    }

    // Pass validated arguments to tool.run() which handles auth, validation, timeout, sanitization
    return await tool.run(parsedArgs || {}, context);
  }
}

// Default registry populated with all standard allowlisted tools
export const defaultToolRegistry = new ToolRegistry();
defaultToolRegistry.registerTool(new SearchProductsTool());
defaultToolRegistry.registerTool(new SemanticProductSearchTool());
defaultToolRegistry.registerTool(new GetProductDetailsTool());
defaultToolRegistry.registerTool(new CheckProductAvailabilityTool());
defaultToolRegistry.registerTool(new GetUserOrderStatusTool());
defaultToolRegistry.registerTool(new CheckStorePolicyTool());
defaultToolRegistry.registerTool(new SearchKnowledgeTool());
defaultToolRegistry.registerTool(new GetCartTool());
defaultToolRegistry.registerTool(new AddToCartTool());
defaultToolRegistry.registerTool(new RemoveFromCartTool());
defaultToolRegistry.registerTool(new UpdateCartQuantityTool());
defaultToolRegistry.registerTool(new AddToWishlistTool());
defaultToolRegistry.registerTool(new RemoveFromWishlistTool());
defaultToolRegistry.registerTool(new GetUserOrdersTool());
defaultToolRegistry.registerTool(new GetOrderDetailsTool());
defaultToolRegistry.registerTool(new GetUserProfileTool());
defaultToolRegistry.registerTool(new CancelOrderTool());
