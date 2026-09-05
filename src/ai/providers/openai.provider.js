import { LLMProvider } from "./base.provider.js";
import { AiError } from "../errors/aiError.js";

export class OpenAIProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = "openai";
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
    this.model = config.model || "gpt-4o-mini";
    this.baseUrl = "https://api.openai.com/v1";
  }

  async generateResponse({ messages, tools = [], options = {} }) {
    if (!this.apiKey) {
      throw AiError.providerUnavailable(
        "openai",
        "OPENAI_API_KEY is not configured in environment"
      );
    }

    const payload = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? this.config.temperature ?? 0.2,
      max_tokens: options.maxTokens || this.config.maxTokens || 1024,
    };

    if (tools.length > 0) {
      payload.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const timeoutMs = options.timeoutMs || this.config.timeoutMs || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message || {};

      const toolCalls = (message.tool_calls || []).map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.function?.name,
          arguments: tc.function?.arguments,
        },
      }));

      const usage = {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      };

      return {
        content: message.content || "",
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage,
        model: this.model,
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw AiError.timeout(timeoutMs);
      }
      throw AiError.providerUnavailable("openai", err.message);
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck() {
    if (!this.apiKey) {
      return {
        healthy: false,
        provider: "openai",
        model: this.model,
        message: "OpenAI API key is not configured.",
      };
    }

    const startTime = Date.now();
    try {
      await this.generateResponse({
        messages: [{ role: "user", content: "Ping" }],
        options: { maxTokens: 5, timeoutMs: 5000 },
      });
      return {
        healthy: true,
        provider: "openai",
        model: this.model,
        latencyMs: Date.now() - startTime,
        message: "OpenAI API connected successfully.",
      };
    } catch (err) {
      return {
        healthy: false,
        provider: "openai",
        model: this.model,
        latencyMs: Date.now() - startTime,
        message: err.message,
      };
    }
  }
}
