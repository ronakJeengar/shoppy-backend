import { aiConfig } from "../config/ai.config.js";
import { AiError } from "../errors/aiError.js";
import { getDefaultLLMProvider } from "../providers/provider.factory.js";
import { defaultToolRegistry } from "../tools/tool.registry.js";
import { defaultContextBuilder } from "./contextBuilder.js";
import { buildPromptMessages } from "../prompts/promptBuilder.js";
import { ASSISTANT_PROMPT_V1 } from "../prompts/assistant.v1.js";
import {
  checkPromptInjection,
  sanitizeUserInput,
  validateStructuredResponse,
} from "../safety/aiSafety.js";
import {
  generateAiRequestId,
  logAiEvent,
  sanitizeAiText,
} from "../observability/aiLogger.js";

export class AiService {
  constructor({
    llmProvider = null,
    toolRegistry = defaultToolRegistry,
    contextBuilder = defaultContextBuilder,
  } = {}) {
    this.llmProvider = llmProvider;
    this.toolRegistry = toolRegistry;
    this.contextBuilder = contextBuilder;
  }

  _getProvider() {
    return this.llmProvider || getDefaultLLMProvider();
  }

  /**
   * Primary entry point for AI conversational or task requests.
   * Executes multi-turn agent tool loop and formats structured assistant outputs.
   */
  async processRequest({
    message,
    user = null,
    history = [],
    systemPrompt = ASSISTANT_PROMPT_V1,
    options = {},
  }) {
    const requestId = generateAiRequestId();
    const startTime = Date.now();
    const provider = this._getProvider();

    // 1. Check Feature Flag
    if (!aiConfig.enabled) {
      throw AiError.disabled();
    }

    // 2. Input Validation & Safety Check
    if (!message || typeof message !== "string" || !message.trim()) {
      throw new AiError("AI_INVALID_REQUEST", "Message content is required", {}, 400);
    }

    const injectionCheck = checkPromptInjection(message);
    if (!injectionCheck.isSafe) {
      logAiEvent({
        requestId,
        event: "PROMPT_INJECTION_DETECTED",
        provider: provider.providerName,
        model: provider.model || aiConfig.model,
        durationMs: Date.now() - startTime,
        success: false,
        error: injectionCheck.reason,
      });
      throw AiError.safetyViolation(injectionCheck.reason);
    }

    const sanitizedMessage = sanitizeUserInput(message);

    // 3. Build Minimal Task-Scoped Context
    const retrievedContext = await this.contextBuilder.buildContext({
      query: sanitizedMessage,
      user,
      includeKnowledge: true,
    });

    // 4. Discover Allowlisted Tools Accessible to this User Context
    const availableTools = this.toolRegistry.getAvailableToolDefinitions({ user });

    // 5. Build Formatted Prompt with Strict Trust Boundaries
    const { promptVersion, messages } = buildPromptMessages({
      systemPrompt,
      userMessage: sanitizedMessage,
      retrievedContext,
      history,
    });

    // 6. Multi-turn Agent Tool Calling Loop (bounded at max 3 iterations)
    let currentRawResponse = null;
    let iteration = 0;
    const maxIterations = 3;
    const allExecutedToolResults = [];

    while (iteration < maxIterations) {
      iteration++;

      try {
        currentRawResponse = await provider.generateResponse({
          messages,
          tools: availableTools,
          options: {
            timeoutMs: options.timeoutMs || aiConfig.timeoutMs,
            temperature: options.temperature ?? aiConfig.temperature,
            maxTokens: options.maxTokens || aiConfig.maxTokens,
          },
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;
        logAiEvent({
          requestId,
          event: "LLM_PROVIDER_ERROR",
          provider: provider.providerName,
          model: provider.model || aiConfig.model,
          durationMs,
          success: false,
          error: err,
        });
        throw err;
      }

      // If no tool calls requested, we have our final text!
      if (!currentRawResponse.toolCalls || currentRawResponse.toolCalls.length === 0) {
        break;
      }

      // Execute tool calls
      messages.push({
        role: "assistant",
        content: currentRawResponse.content || "",
        tool_calls: currentRawResponse.toolCalls,
      });

      for (const call of currentRawResponse.toolCalls) {
        const toolName = call.function?.name;
        const toolArgs = call.function?.arguments;

        try {
          const result = await this.toolRegistry.executeTool(toolName, toolArgs, {
            user,
            requestId,
          });

          allExecutedToolResults.push({
            toolCallId: call.id,
            toolName,
            args: toolArgs,
            result,
          });

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: toolName,
            content: JSON.stringify(result || {}),
          });
        } catch (toolErr) {
          allExecutedToolResults.push({
            toolCallId: call.id,
            toolName,
            error: toolErr.message,
          });

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: toolName,
            content: JSON.stringify({ error: toolErr.message }),
          });
        }
      }
    }

    // 7. Validate & Sanitize Output
    const validation = validateStructuredResponse(currentRawResponse);
    if (!validation.isValid) {
      throw new AiError("AI_INVALID_RESPONSE", validation.reason, {}, 502);
    }

    const durationMs = Date.now() - startTime;
    let finalContent = sanitizeAiText(currentRawResponse.content || "");
    if (!finalContent && allExecutedToolResults.length > 0) {
      finalContent = `Executed ${allExecutedToolResults.length} tool(s) successfully: ${allExecutedToolResults.map((t) => t.toolName).join(", ")}.`;
    }

    // 8. Extract Structured Products, Sources & Contextual Actions
    const products = [];
    const sources = [];
    const actions = [];
    const seenProductIds = new Set();

    for (const item of allExecutedToolResults) {
      if (item.result) {
        // Handle search_products
        if (item.toolName === "search_products" && Array.isArray(item.result.results)) {
          for (const p of item.result.results) {
            const pId = (p.id || p._id || "").toString();
            if (pId && !seenProductIds.has(pId)) {
              seenProductIds.add(pId);
              products.push({
                id: pId,
                name: p.name || p.productName || "Product",
                price: typeof p.price === "number" ? p.price : 0,
                inStock: p.inStock !== false,
                stockCount: p.stockCount || 0,
                rating: p.rating || 0,
                seller: p.seller || "Store",
                productImage: p.productImage || "",
                description: p.description || "",
              });
            }
          }
        }

        // Handle get_product_details
        if (item.toolName === "get_product_details" && item.result.exists && item.result.id) {
          const p = item.result;
          const pId = p.id.toString();
          if (!seenProductIds.has(pId)) {
            seenProductIds.add(pId);
            products.push({
              id: pId,
              name: p.name,
              price: p.price,
              inStock: p.inStock !== false,
              stockCount: p.stockCount || 0,
              rating: p.rating || 0,
              seller: p.seller || "Store",
              productImage: p.productImage || "",
              description: p.description || "",
            });
          }
        }

        // Handle get_cart items
        if (item.toolName === "get_cart" && Array.isArray(item.result.items)) {
          for (const ci of item.result.items) {
            const ciId = (ci.productId || ci.id || "").toString();
            if (ciId && !seenProductIds.has(ciId)) {
              seenProductIds.add(ciId);
              products.push({
                id: ciId,
                name: ci.name,
                price: ci.price,
                inStock: ci.inStock !== false,
                stockCount: ci.stockCount || 10,
                rating: 0,
                seller: ci.seller || "Store",
                productImage: ci.productImage || "",
                description: "",
              });
            }
          }
        }

        // Handle search_knowledge
        if (item.toolName === "search_knowledge" && Array.isArray(item.result.results)) {
          for (const doc of item.result.results) {
            sources.push({
              chunkId: doc.chunkId,
              title: doc.title,
              section: doc.section,
              sourceType: doc.sourceType,
              content: doc.content,
              citation: doc.citation,
            });
          }
        }

        // Handle check_store_policy
        if (item.toolName === "check_store_policy" && item.result.topic) {
          sources.push({
            title: `Store Policy: ${item.result.topic}`,
            section: item.result.topic,
            sourceType: "POLICY",
            content: JSON.stringify(item.result),
            citation: { source: "Store Policy", topic: item.result.topic },
          });
        }
      }
    }

    // Build Contextual Navigation Actions
    if (products.length > 0) {
      actions.push({
        type: "OPEN_PRODUCT",
        label: `View ${products[0].name.substring(0, 24)}`,
        payload: { productId: products[0].id },
      });
      actions.push({
        type: "OPEN_SEARCH",
        label: "Search More Products",
        payload: { query: sanitizedMessage },
      });
    }

    const cartToolExecuted = allExecutedToolResults.some((t) =>
      ["get_cart", "add_to_cart", "remove_from_cart"].includes(t.toolName)
    );
    if (cartToolExecuted) {
      actions.push({
        type: "OPEN_CART",
        label: "View Shopping Cart",
        payload: {},
      });
    }

    const orderTool = allExecutedToolResults.find((t) =>
      ["get_order_details", "get_user_order_status"].includes(t.toolName)
    );
    if (orderTool && (orderTool.result?.orderNumber || orderTool.result?.orderId)) {
      const ordId = orderTool.result.orderId || orderTool.result.orderNumber;
      actions.push({
        type: "OPEN_ORDER",
        label: `View Order ${orderTool.result.orderNumber || ordId}`,
        payload: { orderId: ordId },
      });
    } else if (allExecutedToolResults.some((t) => t.toolName === "get_user_orders")) {
      actions.push({
        type: "OPEN_ORDERS",
        label: "View All Orders",
        payload: {},
      });
    }

    // 9. Observability Telemetry
    logAiEvent({
      requestId,
      event: "AI_REQUEST_COMPLETED",
      provider: provider.providerName,
      model: currentRawResponse.model || provider.model || aiConfig.model,
      durationMs,
      tokenUsage: currentRawResponse.usage || { prompt: 0, completion: 0, total: 0 },
      toolsCalled: allExecutedToolResults.map((t) => t.toolName),
      success: true,
      metadata: {
        promptVersion,
        toolsExecuted: allExecutedToolResults.length,
      },
    });

    return {
      requestId,
      conversationId: options.conversationId || null,
      message: finalContent,
      answer: finalContent,
      products,
      sources,
      actions,
      toolResults: allExecutedToolResults.length > 0 ? allExecutedToolResults : undefined,
      metadata: {
        provider: provider.providerName,
        model: currentRawResponse.model || provider.model || aiConfig.model,
        promptVersion,
        durationMs,
      },
    };
  }

  /**
   * Health check for AI subsystem.
   */
  async healthCheck() {
    const provider = this._getProvider();
    const providerHealth = await provider.healthCheck();
    const vectorCount = await this.contextBuilder.vectorStore.count();

    return {
      enabled: aiConfig.enabled,
      provider: provider.providerName,
      model: provider.model || aiConfig.model,
      healthy: providerHealth.healthy,
      providerHealth,
      features: aiConfig.features,
      vectorStore: {
        type: "memory",
        documentCount: vectorCount,
        ready: true,
      },
      allowlistedTools: this.toolRegistry.getAllToolNames(),
    };
  }
}

export const defaultAiService = new AiService();
