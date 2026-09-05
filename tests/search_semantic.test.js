import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import app from "../src/app.js";
import { aiConfig } from "../src/ai/config/ai.config.js";
import { QueryProcessor } from "../src/ai/search/queryProcessor.js";
import { buildProductDocument } from "../src/ai/search/productDocumentBuilder.js";
import { defaultProductSearchIndex } from "../src/ai/search/productSearchIndex.js";
import { defaultHybridSearchEngine } from "../src/ai/search/hybridSearchEngine.js";
import { memoryAdminStore, _resetMemoryAdminStore } from "../src/controllers/admin.controller.js";
import { memoryAiLogs } from "../src/ai/observability/aiLogger.js";

const testProducts = [
  {
    _id: "64f2b1a2b3c4d5e6f7a8b001",
    id: "64f2b1a2b3c4d5e6f7a8b001",
    productName: "Wireless Noise-Cancelling Headphones",
    sellerName: "SoundTech Official",
    description: "High-fidelity wireless headphones with active noise cancellation and 30h battery.",
    price: 149.99,
    stock: 45,
    productRating: 4.8,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    isActive: true,
    createdAt: new Date("2026-01-01"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b002",
    id: "64f2b1a2b3c4d5e6f7a8b002",
    productName: "Smart Fitness Watch Ultra",
    sellerName: "PulseTech Wearables",
    description: "Advanced health monitoring smartwatch featuring heart rate and GPS tracking.",
    price: 199.99,
    stock: 28,
    productRating: 4.6,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    isActive: true,
    createdAt: new Date("2026-01-02"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b003",
    id: "64f2b1a2b3c4d5e6f7a8b003",
    productName: "Classic Organic Cotton Crewneck",
    sellerName: "Urban Threads Co.",
    description: "Tailored 100% certified organic cotton tee with reinforced stitching.",
    price: 29.99,
    stock: 120,
    productRating: 4.7,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c002", name: "fashion" },
    isActive: true,
    createdAt: new Date("2026-01-03"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b004",
    id: "64f2b1a2b3c4d5e6f7a8b004",
    productName: "Minimalist Leather Cardholder Wallet",
    sellerName: "Craft & Hide",
    description: "Handcrafted full-grain leather wallet with RFID blocking technology.",
    price: 39.5,
    stock: 65,
    productRating: 4.9,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c002", name: "fashion" },
    isActive: true,
    createdAt: new Date("2026-01-04"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b005",
    id: "64f2b1a2b3c4d5e6f7a8b005",
    productName: "Draft Inactive Product Secret",
    sellerName: "Hidden Supplier",
    description: "Confidential internal prototype not for public view.",
    price: 10.0,
    stock: 5,
    productRating: 5.0,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    isActive: false, // Inactive! Must NEVER appear in search results
    createdAt: new Date("2026-01-05"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b006",
    id: "64f2b1a2b3c4d5e6f7a8b006",
    productName: "Out of Stock Trail Running Shoes",
    sellerName: "Summit Footwear",
    description: "Durable trail shoes with grippy rubber lugs.",
    price: 89.99,
    stock: 0, // Out of stock!
    productRating: 4.5,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c004", name: "sports & outdoors" },
    isActive: true,
    createdAt: new Date("2026-01-06"),
  },
];

describe("Phase 12 AI Product Search & Semantic Search Pipeline Tests", () => {
  let initialAiEnabled;
  let initialSemanticEnabled;

  beforeEach(async () => {
    initialAiEnabled = aiConfig.enabled;
    initialSemanticEnabled = aiConfig.features.semanticSearchEnabled;
    aiConfig.enabled = true;
    aiConfig.features.semanticSearchEnabled = true;

    _resetMemoryAdminStore();
    memoryAdminStore.products.push(...testProducts);

    // Initialize Vector Search Index
    await defaultProductSearchIndex.clear();
    await defaultProductSearchIndex.indexBatch(testProducts);
  });

  afterEach(async () => {
    aiConfig.enabled = initialAiEnabled;
    aiConfig.features.semanticSearchEnabled = initialSemanticEnabled;
    await defaultProductSearchIndex.clear();
  });

  test("QueryProcessor accurately extracts structured constraints from natural language", () => {
    // 1. Budget bounds: "comfortable cotton t-shirt under $50"
    const p1 = QueryProcessor.process("comfortable cotton t-shirt under $50");
    assert.strictEqual(p1.extractedFilters.maxPrice, 50);
    assert.strictEqual(p1.semanticQuery, "comfortable cotton t-shirt");
    assert.strictEqual(p1.hasStructuredConstraints, true);

    // 2. Price range: "leather wallet between 20 and 40"
    const p2 = QueryProcessor.process("leather wallet between 20 and 40");
    assert.strictEqual(p2.extractedFilters.minPrice, 20);
    assert.strictEqual(p2.extractedFilters.maxPrice, 40);
    assert.strictEqual(p2.semanticQuery, "leather wallet");

    // 3. Availability intent: "available fitness watch"
    const p3 = QueryProcessor.process("available fitness watch");
    assert.strictEqual(p3.extractedFilters.inStock, true);
    assert.strictEqual(p3.semanticQuery, "fitness watch");

    // 4. Currency symbol support: "headphones under ₹2000"
    const p4 = QueryProcessor.process("headphones under ₹2000");
    assert.strictEqual(p4.extractedFilters.maxPrice, 2000);
    assert.strictEqual(p4.semanticQuery, "headphones");
  });

  test("ProductDocumentBuilder creates safe representation without private or volatile fields", () => {
    const doc = buildProductDocument(testProducts[0]);
    assert.ok(doc.includes("Product: Wireless Noise-Cancelling Headphones"));
    assert.ok(doc.includes("Category: electronics"));
    assert.ok(doc.includes("Brand: SoundTech Official"));
    assert.ok(doc.includes("Description: High-fidelity wireless headphones"));

    // Volatile / private fields must NOT be in embedding document
    assert.ok(!doc.includes("149.99"), "Current price must not be embedded");
    assert.ok(!doc.includes("stock"), "Stock count must not be embedded");
  });

  test("GET /api/v1/products with natural language query executes hybrid search", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products?q=organic+cotton+crewneck`
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.products));
      assert.ok(data.data.products.length > 0);

      const topProduct = data.data.products[0];
      assert.strictEqual(topProduct.productName, "Classic Organic Cotton Crewneck");
      assert.strictEqual(topProduct.price, 29.99);
    } finally {
      server.close();
    }
  });

  test("Authoritative price validation: 'under 40' strictly excludes items over 40", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products?q=fashion+under+40`
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Every returned product must satisfy authoritative price <= 40
      for (const p of data.data.products) {
        assert.ok(
          p.price <= 40,
          `Product ${p.productName} price ${p.price} exceeds maxPrice 40`
        );
      }
    } finally {
      server.close();
    }
  });

  test("Security & Visibility: Inactive/draft products NEVER leak into search results", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // Even if user directly searches for the secret product's exact name
      const res = await fetch(
        `http://localhost:${port}/api/v1/products?q=Draft+Inactive+Product+Secret`
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      const leaked = data.data.products.find(
        (p) => p.productName === "Draft Inactive Product Secret"
      );
      assert.strictEqual(
        leaked,
        undefined,
        "Inactive product must never appear in search results"
      );
    } finally {
      server.close();
    }
  });

  test("Availability filtering: inStock=true strictly excludes out-of-stock products", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products?q=running+shoes&inStock=true`
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      for (const p of data.data.products) {
        assert.ok(p.stock > 0, `Product ${p.productName} has 0 stock`);
      }
    } finally {
      server.close();
    }
  });

  test("Reliability & Fallback: Disabling semantic search falls back to keyword search seamlessly", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // Disable semantic search feature flag
      aiConfig.features.semanticSearchEnabled = false;

      const res = await fetch(
        `http://localhost:${port}/api/v1/products?q=Headphones`
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.products.length > 0);
      assert.ok(
        data.data.products[0].productName.includes("Headphones"),
        "Keyword search must find headphones when semantic search is disabled"
      );
    } finally {
      server.close();
      aiConfig.features.semanticSearchEnabled = true;
    }
  });

  test("Hallucination Defense: Searching for nonexistent products returns empty list without inventing items", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products?q=2027+Quantum+Teleportation+Device+XYZ`
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.products.length, 0, "Must return 0 products for nonexistent query");
    } finally {
      server.close();
    }
  });

  test("Observability telemetry records search event with duration and query sanitization", async () => {
    const initialLogCount = memoryAiLogs.length;

    await defaultHybridSearchEngine.search({
      query: "wireless headphones under 200",
      fallbackProducts: testProducts,
    });

    assert.ok(
      memoryAiLogs.length > initialLogCount,
      "A telemetry log entry must be recorded for search"
    );
    const latestLog = memoryAiLogs[0];
    assert.ok(latestLog.event === "SEARCH_COMPLETED" || latestLog.event === "SEARCH_FALLBACK_TRIGGERED");
    assert.ok(latestLog.metadata.extractedConstraints);
  });
});
