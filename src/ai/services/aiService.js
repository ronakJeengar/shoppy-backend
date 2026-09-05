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

    // 6. Invoke LLM Provider with Timeout & Safety Bounds
    let rawResponse = null;
    try {
      rawResponse = await provider.generateResponse({
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

    // 7. Execute Tools if Requested by LLM
    const executedToolResults = [];
    if (rawResponse.toolCalls && rawResponse.toolCalls.length > 0) {
      for (const call of rawResponse.toolCalls) {
        const toolName = call.function?.name;
        const toolArgs = call.function?.arguments;

        try {
          const result = await this.toolRegistry.executeTool(toolName, toolArgs, {
            user,
            requestId,
          });

          executedToolResults.push({
            toolCallId: call.id,
            toolName,
            args: toolArgs,
            result,
          });
        } catch (toolErr) {
          executedToolResults.push({
            toolCallId: call.id,
            toolName,
            error: toolErr.message,
          });
        }
      }
    }

    // 8. Validate & Sanitize Output
    const validation = validateStructuredResponse(rawResponse);
    if (!validation.isValid) {
      throw new AiError("AI_INVALID_RESPONSE", validation.reason, {}, 502);
    }

    const durationMs = Date.now() - startTime;
    let finalContent = sanitizeAiText(rawResponse.content || "");
    if (!finalContent && executedToolResults.length > 0) {
      finalContent = `Executed ${executedToolResults.length} tool(s) successfully: ${executedToolResults.map((t) => t.toolName).join(", ")}.`;
    }

    // 9. Observability Telemetry
    logAiEvent({
      requestId,
      event: "AI_REQUEST_COMPLETED",
      provider: provider.providerName,
      model: rawResponse.model || provider.model || aiConfig.model,
      durationMs,
      tokenUsage: rawResponse.usage || { prompt: 0, completion: 0, total: 0 },
      toolsCalled: executedToolResults.map((t) => t.toolName),
      success: true,
      metadata: {
        promptVersion,
        toolsExecuted: executedToolResults.length,
      },
    });

    return {
      requestId,
      answer: finalContent,
      toolResults: executedToolResults.length > 0 ? executedToolResults : undefined,
      metadata: {
        provider: provider.providerName,
        model: rawResponse.model || provider.model || aiConfig.model,
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
