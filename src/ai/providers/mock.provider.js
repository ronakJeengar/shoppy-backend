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

  setCustomToolCall(promptSubstring, toolCall) {
    return this.setMockToolCall(promptSubstring, toolCall);
  }

  clearMocks() {
    this.customResponses.clear();
    this.customToolCalls.clear();
  }

  async generateResponse({ messages, tools = [], options = {} }) {
    // Check if custom tool call was explicitly configured for testing
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content || "";
    const lower = lastUserMessage.toLowerCase();

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

    // 1. Check if the most recent message is a tool response (agent loop follow-up)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "tool") {
      const toolName = lastMessage.name || "";
      let parsed = {};
      try {
        parsed = JSON.parse(lastMessage.content);
      } catch (_) {}

      if (toolName === "search_products") {
        const count = parsed.count || (parsed.results ? parsed.results.length : 0);
        return {
          content: `I found ${count} product(s) matching your request. Here are the top recommendations:`,
          usage: { promptTokens: 40, completionTokens: 25, totalTokens: 65 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "get_cart") {
        const count = parsed.itemCount || (parsed.items ? parsed.items.length : 0);
        const total = parsed.total || 0;
        return {
          content: count > 0
            ? `Your shopping cart contains ${count} item(s) totaling $${total}.`
            : "Your shopping cart is currently empty.",
          usage: { promptTokens: 35, completionTokens: 20, totalTokens: 55 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "add_to_cart") {
        return {
          content: parsed.message || `Added item to your shopping cart successfully.`,
          usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "remove_from_cart") {
        return {
          content: parsed.message || "Item removed from your cart successfully.",
          usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "get_user_orders") {
        const count = parsed.count || (parsed.orders ? parsed.orders.length : 0);
        return {
          content: count > 0
            ? `Here are your ${count} most recent order(s):`
            : "You don't have any recent orders placed.",
          usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "get_order_details" || toolName === "get_user_order_status") {
        if (parsed.found) {
          return {
            content: `Order ${parsed.orderNumber} is currently ${parsed.status}. Carrier: ${parsed.carrier || "Standard"} (Tracking: ${parsed.trackingNumber || "Pending"}).`,
            usage: { promptTokens: 45, completionTokens: 25, totalTokens: 70 },
            model: this.config.model || "mock-model-v1",
          };
        } else {
          return {
            content: parsed.error || parsed.message || "Order not found or unauthorized.",
            usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
            model: this.config.model || "mock-model-v1",
          };
        }
      }

      if (toolName === "search_knowledge" || toolName === "check_store_policy") {
        return {
          content: "According to our authoritative store policies:",
          usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "update_cart_quantity") {
        return {
          content: parsed.message || `Updated quantity in your shopping cart successfully.`,
          usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "add_to_wishlist" || toolName === "remove_from_wishlist") {
        return {
          content: parsed.message || (toolName === "add_to_wishlist" ? "Added to your wishlist." : "Removed from your wishlist."),
          usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "check_product_availability") {
        return {
          content: parsed.message || `The item is ${parsed.status} with ${parsed.stockCount} unit(s) available.`,
          usage: { promptTokens: 35, completionTokens: 15, totalTokens: 50 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "get_user_profile") {
        return {
          content: `Here is your profile: Name: ${parsed.fullName}, Email: ${parsed.email}, Phone: ${parsed.phone}.`,
          usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
          model: this.config.model || "mock-model-v1",
        };
      }

      if (toolName === "cancel_order") {
        if (parsed.requiresConfirmation) {
          return {
            content: parsed.message || `I found your order #${parsed.orderNumber}. Would you like me to cancel it and initiate a refund of $${parsed.totalAmount}?`,
            usage: { promptTokens: 45, completionTokens: 25, totalTokens: 70 },
            model: this.config.model || "mock-model-v1",
          };
        } else if (parsed.success) {
          return {
            content: parsed.message || `Order #${parsed.orderNumber} has been successfully cancelled and refund initiated.`,
            usage: { promptTokens: 45, completionTokens: 25, totalTokens: 70 },
            model: this.config.model || "mock-model-v1",
          };
        } else {
          return {
            content: parsed.error || parsed.message || "Failed to cancel order.",
            usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
            model: this.config.model || "mock-model-v1",
          };
        }
      }

      return {
        content: "I have retrieved the requested information from our store systems.",
        usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
        model: this.config.model || "mock-model-v1",
      };
    }

    // 4. Check if query implies a standard tool call in tests or interactive chat
    if (
      lower.includes("search for") ||
      lower.includes("find product") ||
      lower.includes("recommend") ||
      lower.includes("show me") ||
      lower.includes("looking for")
    ) {
      const match = lower.match(/(?:search for|find product|recommend|show me|looking for)\s+([a-z0-9 ]+)/i);
      const query = match ? match[1].trim() : "wireless";
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_search",
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
      const match = lower.match(/(?:order\s*(?:#|number|id)?\s*)([a-z0-9-]+)/i);
      const orderId = match ? match[1].trim() : "ORD-12345";
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_order_status",
            type: "function",
            function: {
              name: "get_user_order_status",
              arguments: JSON.stringify({ orderId }),
            },
          },
        ],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("my orders") || lower.includes("recent orders") || lower.includes("order history")) {
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_orders",
            type: "function",
            function: {
              name: "get_user_orders",
              arguments: JSON.stringify({ limit: 5 }),
            },
          },
        ],
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("order details")) {
      const match = lower.match(/(?:details for|order\s*(?:#|number|id)?\s*)([a-z0-9-]+)/i);
      const orderId = match ? match[1].trim() : "ORD-2026-X99";
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_order_details",
            type: "function",
            function: {
              name: "get_order_details",
              arguments: JSON.stringify({ orderId }),
            },
          },
        ],
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (
      lower.includes("what is in my cart") ||
      lower.includes("what's in my cart") ||
      lower.includes("view cart") ||
      lower.includes("my cart") ||
      lower.includes("show cart")
    ) {
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_cart",
            type: "function",
            function: {
              name: "get_cart",
              arguments: JSON.stringify({}),
            },
          },
        ],
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("add to cart") || lower.includes("add this to cart")) {
      const match = lower.match(/(?:product|id)\s*([a-z0-9_-]+)/i);
      const productId = match ? match[1].trim() : "64f2b1a2b3c4d5e6f7a8b001";
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_add_cart",
            type: "function",
            function: {
              name: "add_to_cart",
              arguments: JSON.stringify({ productId, quantity: 1 }),
            },
          },
        ],
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("remove from cart") || lower.includes("delete from cart")) {
      const match = lower.match(/(?:product|id)\s*([a-z0-9_-]+)/i);
      const productId = match ? match[1].trim() : "64f2b1a2b3c4d5e6f7a8b001";
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_remove_cart",
            type: "function",
            function: {
              name: "remove_from_cart",
              arguments: JSON.stringify({ productId }),
            },
          },
        ],
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (
      lower.includes("return policy") ||
      lower.includes("return window") ||
      lower.includes("how do i return") ||
      lower.includes("warranty policy") ||
      lower.includes("shipping policy") ||
      lower.includes("store policy")
    ) {
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_knowledge",
            type: "function",
            function: {
              name: "search_knowledge",
              arguments: JSON.stringify({ query: lastUserMessage }),
            },
          },
        ],
        usage: { promptTokens: 45, completionTokens: 25, totalTokens: 70 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("cancel order") || lower.includes("cancel my order")) {
      const match = lower.match(/(?:order\s*(?:#|number|id)?\s*)([a-z0-9-]+)/i);
      const orderId = match ? match[1].trim() : "64f1b2c3d4e5f6a7b8c90001";
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_cancel_order",
            type: "function",
            function: {
              name: "cancel_order",
              arguments: JSON.stringify({ orderId, reason: "Customer requested cancellation via chat" }),
            },
          },
        ],
        usage: { promptTokens: 45, completionTokens: 20, totalTokens: 65 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("update quantity") || lower.includes("change quantity") || lower.includes("set quantity")) {
      const match = lower.match(/(?:to\s*)(\d+)/i);
      const qty = match ? parseInt(match[1], 10) : 2;
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_update_qty",
            type: "function",
            function: {
              name: "update_cart_quantity",
              arguments: JSON.stringify({ productId: "64f2b1a2b3c4d5e6f7a8b001", quantity: qty }),
            },
          },
        ],
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("add to wishlist") || lower.includes("save to wishlist") || lower.includes("add this to my wishlist")) {
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_add_wishlist",
            type: "function",
            function: {
              name: "add_to_wishlist",
              arguments: JSON.stringify({ productId: "64f2b1a2b3c4d5e6f7a8b001" }),
            },
          },
        ],
        usage: { promptTokens: 35, completionTokens: 15, totalTokens: 50 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("remove from wishlist")) {
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_remove_wishlist",
            type: "function",
            function: {
              name: "remove_from_wishlist",
              arguments: JSON.stringify({ productId: "64f2b1a2b3c4d5e6f7a8b001" }),
            },
          },
        ],
        usage: { promptTokens: 35, completionTokens: 15, totalTokens: 50 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("in stock") || lower.includes("check stock") || lower.includes("product availability")) {
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_check_avail",
            type: "function",
            function: {
              name: "check_product_availability",
              arguments: JSON.stringify({ productId: "64f2b1a2b3c4d5e6f7a8b001" }),
            },
          },
        ],
        usage: { promptTokens: 35, completionTokens: 15, totalTokens: 50 },
        model: this.config.model || "mock-model-v1",
      };
    }

    if (lower.includes("my profile") || lower.includes("user profile") || lower.includes("my account details")) {
      return {
        content: "",
        toolCalls: [
          {
            id: "call_mock_profile",
            type: "function",
            function: {
              name: "get_user_profile",
              arguments: JSON.stringify({}),
            },
          },
        ],
        usage: { promptTokens: 35, completionTokens: 15, totalTokens: 50 },
        model: this.config.model || "mock-model-v1",
      };
    }

    // 5. Check if custom response was configured
    for (const [key, resp] of this.customResponses.entries()) {
      if (lower.includes(key)) {
        return {
          content: resp,
          usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
          model: this.config.model || "mock-model-v1",
        };
      }
    }

    // 6. Default conversational response
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
