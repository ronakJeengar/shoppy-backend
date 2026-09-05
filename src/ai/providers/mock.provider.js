import { LLMProvider } from "./base.provider.js";

export class MockLLMProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = "mock";
    this.customResponses = new Map();
    this.customToolCalls = new Map();
  }

  setMockResponse(promptSubstring, response) {
    this.customResponses.set(promptSubstring.toLowerCase(), response);
  }

  setMockToolCall(promptSubstring, toolCall) {
    this.customToolCalls.set(promptSubstring.toLowerCase(), toolCall);
  }

  clearMocks() {
    this.customResponses.clear(
      );
    this.customToolCalls.clear();
  }

  async generateResponse({ messages, tools = [], options = {} }) {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content || "";

    const lower = lastUserMessage.toLowerCase();

    // Check if custom tool call was configured
    for (const [key, toolCall] of this.customToolCalls.entries()) {
      if (lower.includes(key)) {
        return {
          content: "",
          toolCalls: Array.isArray(toolCall) ? toolCall : [toolCall],
          usage: { promptTokens: 45, completionTokens: 25, totalTokens: 70 },
          model: this.config.model || "mock-model-v1",
        };
      }
    }

    // Check if query implies a standard tool call in tests
    if (lower.includes("search for") || lower.includes("find product")) {
      const match = lower.match(/(?:search for|find product)\s+([a-z0-9 ]+)/i);
      const query = match ? match[1].trim() : "wireless";
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_1",
            type: "function",
            function: {
              name: "search_products",
              arguments: JSON.stringify({ query }),
            },
          },
        ],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("where is my order") || lower.includes("track order")) {
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_2",
            type: "function",
            function: {
              name: "get_user_order_status",
              arguments: JSON.stringify({ orderId: "ORD-12345" }),
            },
          },
        ],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        model: this.config.model || "mock-model-v1",
      };
    }

    // Check if custom response was configured
    for (const [key, resp] of this.customResponses.entries()) {
      if (lower.includes(key)) {
        return {
          content: resp,
          usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
          model: this.config.model || "mock-model-v1",
        };
      }
    }

    // Default conversational response
    return {
      content:
        "Hello! I am Shoppy's AI assistant foundation. I can help you search the product catalog and answer store policy questions.",
      usage: { promptTokens: 35, completionTokens: 25, totalTokens: 60 },
      model: this.config.model || "mock-model-v1",
    };
  }

  async healthCheck() {
    return {
      healthy: true,
      provider: "mock",
      model: this.config.model || "mock-model-v1",
      latencyMs: 1,
      message: "Mock LLM Provider is ready and operating in test mode.",
    };
  }
}
