import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { McpServer } from "../src/ai/mcp/server/mcpServer.js";
import { defaultMcpServer } from "../src/ai/mcp/server/mcpServer.js";
import { MCP_ERROR_CODES } from "../src/ai/mcp/protocol/mcpErrors.js";
import { mcpConfig } from "../src/ai/mcp/config/mcp.config.js";
import { defaultConfirmationService } from "../src/ai/services/confirmation.service.js";
import { inMemoryOrders } from "../src/controllers/order.controller.js";
import { memoryCarts } from "../src/controllers/cart.controller.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

describe("Phase 17 Model Context Protocol (MCP) Integration Tests", () => {
  const userA = {
    _id: "64f1a2b3c4d5e6f7a8b90001",
    id: "64f1a2b3c4d5e6f7a8b90001",
    fullName: "Alice Customer",
    email: "alice@example.com",
    role: "CUSTOMER",
    phone: "+1 555-0101",
  };

  const userB = {
    _id: "64f1a2b3c4d5e6f7a8b90002",
    id: "64f1a2b3c4d5e6f7a8b90002",
    fullName: "Bob Customer",
    email: "bob@example.com",
    role: "CUSTOMER",
    phone: "+1 555-0102",
  };

  const tokenUserA = jwt.sign(userA, secretKey, { expiresIn: "1h" });
  const tokenUserB = jwt.sign(userB, secretKey, { expiresIn: "1h" });

  let server;
  let baseUrl;

  before(async () => {
    server = app.listen(0);
    const { port } = server.address();
    baseUrl = `http://localhost:${port}`;
  });

  after(() => {
    if (server) server.close();
  });

  beforeEach(() => {
    inMemoryOrders.clear();
    memoryCarts.clear();
    defaultConfirmationService.store.clear();

    // Reset rate limiter on default MCP server
    defaultMcpServer.rateLimitMap.clear();

    // Seed test order owned by Alice (User A)
    const testOrder = {
      _id: "64f1a2b3c4d5e6f7a8b99001",
      id: "64f1a2b3c4d5e6f7a8b99001",
      orderNumber: "ORD-MCP-1001",
      user: userA._id,
      customer: userA._id,
      items: [
        {
          product: "64f2b1a2b3c4d5e6f7a8b001",
          name: "Wireless Headphones",
          quantity: 1,
          price: 149.99,
          totalPrice: 149.99,
        },
      ],
      totalAmount: 149.99,
      status: "CONFIRMED",
      orderStatus: "CONFIRMED",
      paymentStatus: "COMPLETED",
      createdAt: new Date().toISOString(),
    };
    inMemoryOrders.set(testOrder._id, testOrder);
  });

  describe("1. JSON-RPC 2.0 Protocol & Handshake", () => {
    it("initialize returns protocol version, capabilities, and serverInfo", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { clientInfo: { name: "test-client", version: "1.0.0" } },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.jsonrpc, "2.0");
      assert.strictEqual(data.id, 1);
      assert.strictEqual(data.result.protocolVersion, "2024-11-05");
      assert.ok(data.result.capabilities.tools);
      assert.ok(data.result.capabilities.resources);
      assert.ok(data.result.capabilities.prompts);
      assert.strictEqual(data.result.serverInfo.name, "shoppy-mcp-server");
    });

    it("ping method responds with empty result object", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "ping",
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.jsonrpc, "2.0");
      assert.strictEqual(data.id, 2);
      assert.deepStrictEqual(data.result, {});
    });

    it("notifications/initialized returns 204 No Content", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      });

      assert.strictEqual(response.status, 204);
    });

    it("unknown method returns JSON-RPC Method Not Found (-32601)", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "non_existent_method",
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.jsonrpc, "2.0");
      assert.strictEqual(data.id, 3);
      assert.strictEqual(data.error.code, MCP_ERROR_CODES.METHOD_NOT_FOUND);
      assert.ok(data.error.message.includes("non_existent_method"));
    });

    it("invalid JSON-RPC version returns Invalid Request (-32600)", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "1.0",
          id: 4,
          method: "ping",
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.error.code, MCP_ERROR_CODES.INVALID_REQUEST);
    });

    it("supports batch JSON-RPC requests correctly", async () => {
      const batch = [
        { jsonrpc: "2.0", id: 10, method: "ping" },
        { jsonrpc: "2.0", id: 11, method: "ping" },
      ];

      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(Array.isArray(data));
      assert.strictEqual(data.length, 2);
      assert.strictEqual(data[0].id, 10);
      assert.strictEqual(data[1].id, 11);
    });
  });

  describe("2. Tools Discovery (tools/list) & Visibility", () => {
    it("unauthenticated caller receives only public tools", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 20,
          method: "tools/list",
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(Array.isArray(data.result.tools));

      const toolNames = data.result.tools.map((t) => t.name);
      assert.ok(toolNames.includes("search_products"));
      assert.ok(toolNames.includes("get_product_details"));
      assert.ok(toolNames.includes("check_store_policy"));
      assert.ok(toolNames.includes("check_product_availability"));

      // Authenticated customer tools MUST NOT leak to anonymous caller
      assert.strictEqual(toolNames.includes("get_cart"), false);
      assert.strictEqual(toolNames.includes("get_user_orders"), false);
      assert.strictEqual(toolNames.includes("cancel_order"), false);
    });

    it("authenticated customer caller receives customer tools", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserA}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 21,
          method: "tools/list",
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      const toolNames = data.result.tools.map((t) => t.name);

      assert.ok(toolNames.includes("search_products"));
      assert.ok(toolNames.includes("get_cart"));
      assert.ok(toolNames.includes("get_user_orders"));
      assert.ok(toolNames.includes("cancel_order"));
    });
  });

  describe("3. Tools Execution (tools/call), Auth & Anti-IDOR", () => {
    it("public tool execution (search_products) succeeds without auth", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 30,
          method: "tools/call",
          params: {
            name: "search_products",
            arguments: { query: "wireless", limit: 2 },
          },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.jsonrpc, "2.0");
      assert.strictEqual(data.id, 30);
      assert.ok(data.result.content);
      assert.strictEqual(data.result.isError, false);

      const parsed = JSON.parse(data.result.content[0].text);
      assert.ok(Array.isArray(parsed.results));
    });

    it("public tool check_store_policy returns returns policy", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 31,
          method: "tools/call",
          params: {
            name: "check_store_policy",
            arguments: { topic: "returns" },
          },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.result.isError, false);
      const parsed = JSON.parse(data.result.content[0].text);
      assert.strictEqual(parsed.topic, "returns");
      assert.strictEqual(parsed.windowDays, 30);
    });

    it("authenticated tool (get_cart) without auth returns UNAUTHORIZED (-32001)", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 32,
          method: "tools/call",
          params: {
            name: "get_cart",
            arguments: {},
          },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.error.code, MCP_ERROR_CODES.UNAUTHORIZED);
      assert.strictEqual(data.error.message, "Unauthorized");
    });

    it("authenticated tool (get_cart) with valid JWT returns user cart", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserA}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 33,
          method: "tools/call",
          params: {
            name: "get_cart",
            arguments: {},
          },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.result.isError, false);
      const parsed = JSON.parse(data.result.content[0].text);
      assert.ok(Array.isArray(parsed.items));
    });

    it("Anti-IDOR: Bob cannot access Alice's order details via get_order_details", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserB}`, // Bob
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 34,
          method: "tools/call",
          params: {
            name: "get_order_details",
            arguments: { orderId: "64f1a2b3c4d5e6f7a8b99001" }, // Alice's order
          },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.result.isError, false);
      const parsed = JSON.parse(data.result.content[0].text);
      assert.strictEqual(parsed.found, false);
      assert.ok(
        parsed.error.toLowerCase().includes("unauthorized") ||
        parsed.error.toLowerCase().includes("not found")
      );
    });

    it("Confirmation Gating: cancel_order without confirmation returns CONFIRMATION_REQUIRED", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserA}`, // Alice (owner)
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 35,
          method: "tools/call",
          params: {
            name: "cancel_order",
            arguments: {
              orderId: "64f1a2b3c4d5e6f7a8b99001",
              reason: "Found a better price",
            },
          },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.result.isError, false);

      const parsed = JSON.parse(data.result.content[0].text);
      assert.strictEqual(parsed.requiresConfirmation, true);
      assert.ok(parsed.confirmationId);
      assert.strictEqual(parsed.orderNumber, "ORD-MCP-1001");

      // Verify order was NOT cancelled yet
      const order = inMemoryOrders.get("64f1a2b3c4d5e6f7a8b99001");
      assert.strictEqual(order.status, "CONFIRMED");
    });
  });

  describe("4. Resources Discovery & Reading", () => {
    it("resources/list returns available static and dynamic resources", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 40,
          method: "resources/list",
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(Array.isArray(data.result.resources));

      const uris = data.result.resources.map((r) => r.uri);
      assert.ok(uris.includes("shoppy://policies/returns"));
      assert.ok(uris.includes("shoppy://policies/shipping"));
      assert.ok(uris.includes("shoppy://faq"));
      assert.ok(uris.includes("shoppy://products/{id}"));
    });

    it("resources/read returns static returns policy content", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 41,
          method: "resources/read",
          params: { uri: "shoppy://policies/returns" },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(data.result.contents);
      assert.strictEqual(data.result.contents[0].uri, "shoppy://policies/returns");

      const parsed = JSON.parse(data.result.contents[0].text);
      assert.strictEqual(parsed.windowDays, 30);
      assert.strictEqual(parsed.freeReturns, true);
    });

    it("resources/read returns dynamic product resource by URI", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 42,
          method: "resources/read",
          params: { uri: "shoppy://products/64f2b1a2b3c4d5e6f7a8b001" },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.result.contents[0].uri, "shoppy://products/64f2b1a2b3c4d5e6f7a8b001");

      const product = JSON.parse(data.result.contents[0].text);
      assert.strictEqual(product.id, "64f2b1a2b3c4d5e6f7a8b001");
      assert.strictEqual(product.name, "Wireless Noise-Cancelling Headphones");
      assert.strictEqual(product.price, 149.99);
      assert.strictEqual(product.isInStock, true);
    });

    it("resources/read with non-existent URI returns RESOURCE_NOT_FOUND (-32004)", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 43,
          method: "resources/read",
          params: { uri: "shoppy://unknown/resource" },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.error.code, MCP_ERROR_CODES.RESOURCE_NOT_FOUND);
    });
  });

  describe("5. Prompts Discovery & Rendering", () => {
    it("prompts/list returns registered prompt templates", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 50,
          method: "prompts/list",
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(Array.isArray(data.result.prompts));

      const names = data.result.prompts.map((p) => p.name);
      assert.ok(names.includes("shopping_assistant"));
      assert.ok(names.includes("product_comparison"));
      assert.ok(names.includes("order_help"));
    });

    it("prompts/get renders shopping_assistant prompt", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 51,
          method: "prompts/get",
          params: {
            name: "shopping_assistant",
            arguments: { user_query: "Find wireless noise-cancelling headphones" },
          },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(data.result.messages);
      assert.strictEqual(data.result.messages[0].role, "system");
      assert.ok(data.result.messages[0].content.text.includes("Shopping Assistant"));
      assert.strictEqual(data.result.messages[1].role, "user");
      assert.ok(data.result.messages[1].content.text.includes("Find wireless noise-cancelling headphones"));
    });

    it("prompts/get renders product_comparison template", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 52,
          method: "prompts/get",
          params: {
            name: "product_comparison",
            arguments: { product_a: "Headphones A", product_b: "Headphones B" },
          },
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(data.result.messages);
      assert.ok(data.result.messages[0].content.text.includes("Headphones A"));
      assert.ok(data.result.messages[0].content.text.includes("Headphones B"));
    });
  });

  describe("6. Transport, API Key Authentication & Rate Limiting", () => {
    it("authenticates agent via x-mcp-api-key header", async () => {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-api-key": mcpConfig.apiKey,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 60,
          method: "tools/list",
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      const toolNames = data.result.tools.map((t) => t.name);
      // Service agent has CUSTOMER role, so gets customer tools
      assert.ok(toolNames.includes("get_cart"));
    });

    it("GET /api/v1/mcp/sse responds with text/event-stream and endpoint event", async () => {
      const controller = new AbortController();
      const response = await fetch(`${baseUrl}/api/v1/mcp/sse`, {
        signal: controller.signal,
      });

      assert.strictEqual(response.status, 200);
      assert.ok(response.headers.get("content-type").includes("text/event-stream"));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const text = decoder.decode(value);

      assert.ok(text.includes("event: endpoint"));
      assert.ok(text.includes("/api/v1/mcp?sessionId="));

      controller.abort();
    });

    it("rate limiting blocks client when threshold exceeded", async () => {
      const isolatedServer = new McpServer({
        config: {
          ...mcpConfig,
          rateLimit: { windowMs: 60000, maxRequests: 3 },
        },
      });

      const context = { ip: "192.168.1.100" };
      const req = { jsonrpc: "2.0", id: 1, method: "ping" };

      // Requests 1-3 succeed
      await isolatedServer.handleRequest(req, context);
      await isolatedServer.handleRequest(req, context);
      await isolatedServer.handleRequest(req, context);

      // Request 4 must fail with rate limited error
      const res4 = await isolatedServer.handleRequest(req, context);
      assert.strictEqual(res4.error.code, MCP_ERROR_CODES.RATE_LIMITED);
      assert.ok(res4.error.data.includes("Rate limit exceeded"));
    });

    it("returns forbidden error when MCP_ENABLED is false", async () => {
      const disabledServer = new McpServer({
        config: {
          ...mcpConfig,
          enabled: false,
        },
      });

      const res = await disabledServer.handleRequest({
        jsonrpc: "2.0",
        id: 70,
        method: "ping",
      });

      assert.strictEqual(res.error.code, MCP_ERROR_CODES.FORBIDDEN);
      assert.strictEqual(res.error.message, "MCP server is currently disabled on this environment");
    });
  });
});
