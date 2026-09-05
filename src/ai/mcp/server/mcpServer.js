import { defaultToolRegistry } from "../../tools/tool.registry.js";
import { defaultResourceRegistry } from "../resources/resourceRegistry.js";
import { defaultPromptRegistry } from "../prompts/promptRegistry.js";
import { mcpConfig } from "../config/mcp.config.js";
import { MCP_ERROR_CODES, McpError } from "../protocol/mcpErrors.js";
import {
  createSuccessResponse,
  createErrorResponse,
  validateJsonRpcRequest,
  isNotification,
} from "../protocol/jsonRpc.js";
import { aiLogger } from "../../observability/aiLogger.js";

export class McpServer {
  constructor({
    toolRegistry = defaultToolRegistry,
    resourceRegistry = defaultResourceRegistry,
    promptRegistry = defaultPromptRegistry,
    config = mcpConfig,
  } = {}) {
    this.toolRegistry = toolRegistry;
    this.resourceRegistry = resourceRegistry;
    this.promptRegistry = promptRegistry;
    this.config = config;

    // In-memory rate limiting map: identifier -> { count, resetAt }
    this.rateLimitMap = new Map();
  }

  /**
   * Rate limiting check per client IP or user ID.
   */
  _checkRateLimit(identifier) {
    if (!identifier) return;

    const now = Date.now();
    const entry = this.rateLimitMap.get(identifier);

    if (!entry || now > entry.resetAt) {
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetAt: now + this.config.rateLimit.windowMs,
      });
      return;
    }

    if (entry.count >= this.config.rateLimit.maxRequests) {
      throw McpError.rateLimited(
        `Rate limit exceeded: maximum ${this.config.rateLimit.maxRequests} requests per minute`
      );
    }

    entry.count += 1;
  }

  /**
   * Dispatches a single or batched JSON-RPC 2.0 request.
   * @param {Object|Array} message - JSON-RPC 2.0 request payload
   * @param {Object} context - Execution context (user, headers, ip, transport)
   * @returns {Promise<Object|Array|null>} - Response or null for notifications
   */
  async handleRequest(message, context = {}) {
    // 1. Feature Flag Guard
    if (!this.config.enabled) {
      const err = new McpError(
        MCP_ERROR_CODES.FORBIDDEN,
        "MCP server is currently disabled on this environment"
      );
      return createErrorResponse(message?.id, err);
    }

    // 2. Batch Request Handling
    if (Array.isArray(message)) {
      if (message.length === 0) {
        return createErrorResponse(null, McpError.invalidRequest("Batch request cannot be empty"));
      }

      const results = await Promise.all(
        message.map((item) => this._handleSingleRequest(item, context))
      );
      // Notifications produce no response, filter them out
      const validResponses = results.filter((res) => res !== null);
      return validResponses.length > 0 ? validResponses : null;
    }

    // 3. Single Request Handling
    return await this._handleSingleRequest(message, context);
  }

  async _handleSingleRequest(message, context) {
    const startTime = Date.now();
    const clientIdentifier = context.user?._id || context.ip || "mcp_client";

    try {
      // Validate JSON-RPC syntax
      validateJsonRpcRequest(message);

      // Check if message is a notification (no 'id' field)
      if (isNotification(message)) {
        await this._handleNotification(message, context);
        return null; // Notifications return no response per JSON-RPC 2.0
      }

      // Rate limit check
      if (!context.skipRateLimit) {
        this._checkRateLimit(clientIdentifier);
      }

      const { method, params, id } = message;

      // Method Dispatcher
      let result;
      switch (method) {
        case "initialize":
          result = this._handleInitialize(params, context);
          break;

        case "ping":
          result = {};
          break;

        case "tools/list":
          result = await this._handleToolsList(params, context);
          break;

        case "tools/call":
          result = await this._handleToolsCall(params, context);
          break;

        case "resources/list":
          result = await this._handleResourcesList(params, context);
          break;

        case "resources/read":
          result = await this._handleResourcesRead(params, context);
          break;

        case "prompts/list":
          result = await this._handlePromptsList(params, context);
          break;

        case "prompts/get":
          result = await this._handlePromptsGet(params, context);
          break;

        default:
          throw McpError.methodNotFound(method);
      }

      // Telemetry logging
      if (aiLogger && typeof aiLogger.logAiEvent === "function") {
        aiLogger.logAiEvent("MCP_SUCCESS", {
          method,
          id,
          durationMs: Date.now() - startTime,
          user: context.user?._id || null,
        });
      }

      return createSuccessResponse(id, result);
    } catch (err) {
      if (aiLogger && typeof aiLogger.logAiEvent === "function") {
        aiLogger.logAiEvent("MCP_ERROR", {
          method: message?.method || "unknown",
          id: message?.id || null,
          error: err.message,
          code: err.code || MCP_ERROR_CODES.INTERNAL_ERROR,
        });
      }

      return createErrorResponse(message?.id, err);
    }
  }

  /**
   * Handle JSON-RPC 2.0 notifications.
   */
  async _handleNotification(message, context) {
    if (message.method === "notifications/initialized") {
      // Client confirmed completion of handshake
      return;
    }
    // Unknown notifications are safely ignored without error
  }

  /**
   * Protocol Handshake & Capability Negotiation
   */
  _handleInitialize(params = {}, context = {}) {
    return {
      protocolVersion: this.config.protocolVersion,
      capabilities: {
        tools: {
          listChanged: false,
        },
        resources: {
          subscribe: false,
          listChanged: false,
        },
        prompts: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: this.config.serverInfo.name,
        version: this.config.serverInfo.version,
        description: this.config.serverInfo.description,
      },
    };
  }

  /**
   * List tools available to caller based on context and role authorization.
   */
  async _handleToolsList(params = {}, context = {}) {
    const definitions = this.toolRegistry.getAvailableToolDefinitions(context);

    // Transform definitions to official MCP Tool format
    const tools = definitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters || { type: "object", properties: {} },
    }));

    return { tools };
  }

  /**
   * Execute an allowlisted MCP tool.
   */
  async _handleToolsCall(params = {}, context = {}) {
    if (!params || typeof params !== "object") {
      throw McpError.invalidParams("Parameter object with 'name' and 'arguments' is required");
    }

    const { name, arguments: args = {} } = params;

    if (!name || typeof name !== "string") {
      throw McpError.invalidParams("Tool 'name' must be a valid non-empty string");
    }

    const tool = this.toolRegistry.getTool(name);
    if (!tool) {
      throw McpError.toolError(name, `Tool '${name}' is not recognized or allowlisted.`);
    }

    // Role and Authentication Enforcement
    if (tool.requiresAuth && !context.user) {
      throw McpError.unauthorized(
        `Tool '${name}' requires an authenticated customer session. Provide a valid Bearer token or API key.`
      );
    }

    if (
      tool.requiresAuth &&
      tool.allowedRoles.length > 0 &&
      context.user &&
      !tool.allowedRoles.includes(context.user.role)
    ) {
      throw McpError.forbidden(
        `User role '${context.user.role}' is not permitted to execute tool '${name}'. Required: ${tool.allowedRoles.join(", ")}`
      );
    }

    try {
      const rawResult = await this.toolRegistry.executeTool(name, args, context);

      return {
        content: [
          {
            type: "text",
            text:
              typeof rawResult === "string"
                ? rawResult
                : JSON.stringify(rawResult, null, 2),
          },
        ],
        isError: false,
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err.message || "Tool execution failed",
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * List discoverable static and dynamic resources.
   */
  async _handleResourcesList(params = {}, context = {}) {
    return {
      resources: this.resourceRegistry.listResources(),
    };
  }

  /**
   * Read resource contents by URI.
   */
  async _handleResourcesRead(params = {}, context = {}) {
    if (!params || !params.uri) {
      throw McpError.invalidParams("Parameter 'uri' is required to read a resource");
    }
    return await this.resourceRegistry.readResource(params.uri);
  }

  /**
   * List registered prompt templates.
   */
  async _handlePromptsList(params = {}, context = {}) {
    return {
      prompts: this.promptRegistry.listPrompts(),
    };
  }

  /**
   * Render and retrieve prompt messages.
   */
  async _handlePromptsGet(params = {}, context = {}) {
    if (!params || !params.name) {
      throw McpError.invalidParams("Parameter 'name' is required to get a prompt");
    }
    return this.promptRegistry.getPrompt(params.name, params.arguments || {});
  }
}

export const defaultMcpServer = new McpServer();
