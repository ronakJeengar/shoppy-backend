import { LLMProvider } from "./base.provider.js";
import { AiError } from "../errors/aiError.js";

export class GeminiProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = "gemini";
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || "";
    this.model = config.model || "gemini-1.5-flash";
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  }

  _formatContents(messages) {
    const contents = [];
    let systemInstruction = null;

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else if (msg.role === "assistant") {
        contents.push({
          role: "model",
          parts: [{ text: msg.content || "" }],
        });
      } else {
        contents.push({
          role: "user",
          parts: [{ text: msg.content || "" }],
        });
      }
    }

    return { contents, systemInstruction };
  }

  _formatTools(tools) {
    if (!tools || tools.length === 0) return undefined;

    const functionDeclarations = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: "OBJECT", properties: {} },
    }));

    return [{ functionDeclarations }];
  }

  async generateResponse({ messages, tools = [], options = {} }) {
    if (!this.apiKey) {
      throw AiError.providerUnavailable(
        "gemini",
        "GEMINI_API_KEY is not configured in environment"
      );
    }

    const { contents, systemInstruction } = this._formatContents(messages);
    const formattedTools = this._formatTools(tools);

    const payload = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens || this.config.maxTokens || 1024,
        temperature: options.temperature ?? this.config.temperature ?? 0.2,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    if (formattedTools) {
      payload.tools = formattedTools;
    }

    const timeoutMs = options.timeoutMs || this.config.timeoutMs || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];

      let content = "";
      const toolCalls = [];

      if (part?.functionCall) {
        toolCalls.push({
          id: `call_gemini_${Date.now()}`,
          type: "function",
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        });
      } else if (part?.text) {
        content = part.text;
      }

      const usageMetadata = data.usageMetadata || {};
      const usage = {
        promptTokens: usageMetadata.promptTokenCount || 0,
        completionTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
      };

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage,
        model: this.model,
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw AiError.timeout(timeoutMs);
      }
      throw AiError.providerUnavailable("gemini", err.message);
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck() {
    if (!this.apiKey) {
      return {
        healthy: false,
        provider: "gemini",
        model: this.model,
        message: "Gemini API key is not configured.",
      };
    }

    const startTime = Date.now();
    try {
      const resp = await this.generateResponse({
        messages: [{ role: "user", content: "Ping" }],
        options: { maxTokens: 5, timeoutMs: 5000 },
      });
      return {
        healthy: true,
        provider: "gemini",
        model: this.model,
        latencyMs: Date.now() - startTime,
        message: "Gemini API connected successfully.",
      };
    } catch (err) {
      return {
        healthy: false,
        provider: "gemini",
        model: this.model,
        latencyMs: Date.now() - startTime,
        message: err.message,
      };
    }
  }
}
