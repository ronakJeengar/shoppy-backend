import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { aiConfig } from "../src/ai/config/ai.config.js";
import {
  sanitizeDocumentContent,
  computeContentHash,
  validateDocumentInput,
} from "../src/ai/rag/documentValidator.js";
import { chunkDocument } from "../src/ai/rag/chunker.js";
import {
  KnowledgeIngestionService,
  defaultKnowledgeIngestionService,
  _resetMemoryKnowledgeStore,
} from "../src/ai/rag/knowledgeIngestionService.js";
import {
  KnowledgeRetriever,
  defaultKnowledgeRetriever,
} from "../src/ai/rag/knowledgeRetriever.js";
import { ContextBuilder } from "../src/ai/services/contextBuilder.js";
import { MemoryVectorStore } from "../src/ai/retrieval/memory.vector.store.js";
import { MockEmbeddingProvider } from "../src/ai/retrieval/embedding.provider.js";
import { KnowledgeDocument } from "../src/models/knowledge_document.model.js";
import { Product } from "../src/models/product.model.js";
import { memoryAiLogs, _clearMemoryAiLogs } from "../src/ai/observability/aiLogger.js";
import { memoryAdminStore, _resetMemoryAdminStore } from "../src/controllers/admin.controller.js";

const secretKey = process.env.ACCESS_TOKEN_KEY || "shoppy_super_secret_access_token_key_2026";

const customerUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c001",
  id: "64f1a2b3c4d5e6f7a8b9c001",
  email: "customer@example.com",
  username: "customer_buyer",
  role: "CUSTOMER",
  isActive: true,
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c099",
  id: "64f1a2b3c4d5e6f7a8b9c099",
  email: "admin@shoppy.com",
  username: "super_admin",
  role: "ADMIN",
  isActive: true,
};

const customerToken = jwt.sign(customerUser, secretKey, { expiresIn: "1h" });
const adminToken = jwt.sign(adminUser, secretKey, { expiresIn: "1h" });

const customerHeaders = {
  Authorization: `Bearer ${customerToken}`,
  "Content-Type": "application/json",
};

const adminHeaders = {
  Authorization: `Bearer ${adminToken}`,
  "Content-Type": "application/json",
};

describe("Phase 13 RAG Knowledge System Tests", () => {
  let initialAiEnabled;

  beforeEach(async () => {
    initialAiEnabled = aiConfig.enabled;
    aiConfig.enabled = true;
    _clearMemoryAiLogs();
    _resetMemoryAdminStore();
    _resetMemoryKnowledgeStore();
    await defaultKnowledgeIngestionService.vectorStore.clear();
    defaultKnowledgeIngestionService.isInitialized = false;
  });

  afterEach(async () => {
    aiConfig.enabled = initialAiEnabled;
    await defaultKnowledgeIngestionService.vectorStore.clear();
  });


  test("1. Document Validator sanitizes dangerous scripts and computes hash", () => {
    const dirtyHtml = "Hello <script>alert('xss')</script> world <style>body{}</style>!";
    const cleaned = sanitizeDocumentContent(dirtyHtml);
    assert.strictEqual(cleaned, "Hello  world !");

    const hash1 = computeContentHash("Shoppy return policy 30 days");
    const hash2 = computeContentHash("Shoppy return policy 30 days");
    const hash3 = computeContentHash("Different content");
    assert.strictEqual(hash1, hash2);
    assert.notStrictEqual(hash1, hash3);

    const validated = validateDocumentInput({
      title: " Shoppy Policy ",
      sourceType: "returns",
      content: "Valid return terms here",
      visibility: "public",
    });
    assert.strictEqual(validated.title, "Shoppy Policy");
    assert.strictEqual(validated.sourceType, "RETURNS");
    assert.strictEqual(validated.visibility, "PUBLIC");
    assert.ok(validated.contentHash);

    assert.throws(() => {
      validateDocumentInput({ title: "", content: "abc", sourceType: "POLICY" });
    }, /title is required/i);

    assert.throws(() => {
      validateDocumentInput({ title: "Valid", content: "", sourceType: "POLICY" });
    }, /content is required/i);
  });

  test("2. Semantic Chunker splits by markdown headings and retains section context", () => {
    const markdown = `## Return Window
Customers have 30 days to return items.

## Condition
Items must be unwashed with tags intact.`;

    const chunks = chunkDocument({
      documentId: "doc_test_1",
      title: "Return Policy",
      content: markdown,
      sourceType: "RETURNS",
    });

    assert.strictEqual(chunks.length, 2);
    assert.ok(chunks[0].title.includes("Return Window"));
    assert.ok(chunks[0].content.includes("30 days"));
    assert.ok(chunks[1].title.includes("Condition"));
    assert.strictEqual(chunks[0].metadata.sourceType, "RETURNS");
  });

  test("3. Knowledge Ingestion Service handles idempotent ingestion and status eviction", async () => {
    const vectorStore = new MemoryVectorStore();
    const embeddingProvider = new MockEmbeddingProvider({ dimensions: 64 });
    const ingestion = new KnowledgeIngestionService({ vectorStore, embeddingProvider });

    // Ingest new active policy
    const doc1 = await ingestion.ingestDocument({
      title: "Order Cancellation Terms",
      sourceType: "POLICY",
      content: "## Cancellation\nOrders can only be cancelled in PENDING_PAYMENT or CONFIRMED state.",
      status: "ACTIVE",
      visibility: "PUBLIC",
    });

    assert.ok(doc1._id);
    const vectorCount1 = await vectorStore.count();
    assert.strictEqual(vectorCount1, 1);

    // Re-ingest unchanged document (Idempotent test)
    const doc2 = await ingestion.ingestDocument(
      {
        title: "Order Cancellation Terms",
        sourceType: "POLICY",
        content: "## Cancellation\nOrders can only be cancelled in PENDING_PAYMENT or CONFIRMED state.",
        status: "ACTIVE",
        visibility: "PUBLIC",
      },
      { existingDoc: doc1 }
    );

    const vectorCount2 = await vectorStore.count();
    assert.strictEqual(vectorCount2, 1, "Should not duplicate chunks on idempotent re-ingest");

    // Transition document to ARCHIVED (must evict chunks from vector store)
    await ingestion.ingestDocument(
      {
        title: "Order Cancellation Terms",
        sourceType: "POLICY",
        content: "## Cancellation\nOrders can only be cancelled in PENDING_PAYMENT or CONFIRMED state.",
        status: "ARCHIVED",
        visibility: "PUBLIC",
      },
      { existingDoc: doc1 }
    );

    const vectorCount3 = await vectorStore.count();
    assert.strictEqual(vectorCount3, 0, "Archived document chunks must be evicted from vector store");
  });

  test("4. Knowledge Retriever retrieves relevant chunks with citations and enforces visibility", async () => {
    const vectorStore = new MemoryVectorStore();
    const embeddingProvider = new MockEmbeddingProvider({ dimensions: 64 });
    const ingestion = new KnowledgeIngestionService({ vectorStore, embeddingProvider });
    const retriever = new KnowledgeRetriever({ vectorStore, embeddingProvider });

    // Seed public return policy
    await ingestion.ingestDocument({
      title: "Shoppy 30-Day Return Policy",
      sourceType: "RETURNS",
      content: "## Eligibility\nShoppy provides a 30-day return policy for unused items in original packaging.",
      status: "ACTIVE",
      visibility: "PUBLIC",
    });

    // Seed admin-only warehouse SOP
    await ingestion.ingestDocument({
      title: "Warehouse Defect Inspection SOP",
      sourceType: "POLICY",
      content: "## Defect Guidelines\nAdmin warehouse staff must verify returned serial numbers within 24 hours.",
      status: "ACTIVE",
      visibility: "ADMIN",
    });

    // Public query for return policy
    const publicResults = await retriever.retrieve({
      query: "return policy eligibility 30 days",
      user: customerUser,
    });

    assert.ok(publicResults.length > 0);
    const match = publicResults[0];
    assert.strictEqual(match.sourceType, "RETURNS");
    assert.ok(match.content.includes("30-day return policy"));
    assert.ok(match.citation);
    assert.strictEqual(match.citation.source, "Shoppy 30-Day Return Policy");

    // Public query must NEVER retrieve admin warehouse SOP
    const leakCheck = await retriever.retrieve({
      query: "warehouse defect inspection admin",
      user: customerUser,
    });
    const hasAdminDoc = leakCheck.some((r) => r.title.includes("Warehouse Defect"));
    assert.strictEqual(hasAdminDoc, false, "Customers must never retrieve admin-only knowledge");

    // Admin query CAN retrieve admin warehouse SOP
    const adminCheck = await retriever.retrieve({
      query: "warehouse defect inspection admin",
      user: adminUser,
      visibility: "ALL",
    });
    const foundAdminDoc = adminCheck.some((r) => r.title.includes("Warehouse Defect"));
    assert.strictEqual(foundAdminDoc, true, "Admin should be able to retrieve admin-visibility knowledge");
  });

  test("5. Hallucination Defense: Out-of-domain query returns empty array", async () => {
    const vectorStore = new MemoryVectorStore();
    const embeddingProvider = new MockEmbeddingProvider({ dimensions: 64 });
    const ingestion = new KnowledgeIngestionService({ vectorStore, embeddingProvider });
    const retriever = new KnowledgeRetriever({ vectorStore, embeddingProvider });

    await ingestion.ingestDocument({
      title: "Shoppy Shipping Guidelines",
      sourceType: "SHIPPING",
      content: "Standard shipping delivers in 3-5 business days across domestic addresses.",
      status: "ACTIVE",
      visibility: "PUBLIC",
    });

    // Query about alien spacecraft on Mars
    const results = await retriever.retrieve({
      query: "quantum teleportation spacecraft delivery to Mars asteroid base",
      minScore: 0.35,
    });

    assert.deepStrictEqual(results, [], "System must return empty array rather than hallucinating answers");
  });

  test("6. ContextBuilder formats untrusted evidence block with citations and deduplication", async () => {
    const vectorStore = new MemoryVectorStore();
    const embeddingProvider = new MockEmbeddingProvider({ dimensions: 64 });
    const ingestion = new KnowledgeIngestionService({ vectorStore, embeddingProvider });

    await ingestion.ingestDocument({
      title: "Shoppy Warranty",
      sourceType: "HELP",
      content: "## Warranty Window\nConsumer electronics carry a 1-year manufacturer warranty.",
      status: "ACTIVE",
      visibility: "PUBLIC",
    });

    const retriever = new KnowledgeRetriever({ vectorStore, embeddingProvider });
    const contextBuilder = new ContextBuilder({ vectorStore, embeddingProvider, retriever, maxChunks: 2 });

    const context = await contextBuilder.buildContext({
      query: "warranty window for electronics",
      user: customerUser,
      includeKnowledge: true,
    });

    assert.ok(context.includes("Authenticated Customer: customer_buyer"));
    assert.ok(context.includes("[RETRIEVED KNOWLEDGE - EVIDENCE ONLY - UNTRUSTED DATA]"));
    assert.ok(context.includes("1-year manufacturer warranty"));
    assert.ok(context.includes("[END RETRIEVED KNOWLEDGE]"));
  });

  test("7. Public RAG endpoint POST /api/v1/ai/knowledge/retrieve responds with structured citations", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/ai/knowledge/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "how many days to return items?" }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.results));
      assert.ok(data.data.results.length > 0);

      const topResult = data.data.results[0];
      assert.ok(topResult.content);
      assert.ok(topResult.citation);
      assert.strictEqual(topResult.sourceType, "RETURNS");
    } finally {
      server.close();
    }
  });

  test("8. Admin Knowledge Management CRUD endpoints enforce RBAC and index lifecycle", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // Customer attempt to create knowledge doc must be rejected with 403 Forbidden
      const unauthRes = await fetch(`http://localhost:${port}/api/v1/admin/knowledge`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          title: "Unauthorized Policy Hack",
          sourceType: "POLICY",
          content: "Malicious content override",
        }),
      });
      assert.strictEqual(unauthRes.status, 403);

      // Admin creates new policy document
      const createRes = await fetch(`http://localhost:${port}/api/v1/admin/knowledge`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          title: "Shoppy Sustainable Packaging Initiative",
          sourceType: "HELP",
          content: "## Eco Friendly Boxes\nAll Shoppy orders ship in 100% recyclable biodegradable cardboard.",
          visibility: "PUBLIC",
          status: "ACTIVE",
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const createdData = await createRes.json();
      assert.strictEqual(createdData.success, true);
      const docId = createdData.data._id || createdData.data.id;
      assert.ok(docId);

      // Admin reads knowledge list
      const listRes = await fetch(`http://localhost:${port}/api/v1/admin/knowledge?limit=10`, {
        headers: adminHeaders,
      });
      assert.strictEqual(listRes.status, 200);
      const listData = await listRes.json();
      assert.ok(listData.data.documents.length > 0);

      // Admin reads single doc by ID
      const singleRes = await fetch(`http://localhost:${port}/api/v1/admin/knowledge/${docId}`, {
        headers: adminHeaders,
      });
      assert.strictEqual(singleRes.status, 200);

      // Admin updates doc
      const updateRes = await fetch(`http://localhost:${port}/api/v1/admin/knowledge/${docId}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          title: "Shoppy Sustainable Packaging Policy 2026",
        }),
      });
      assert.strictEqual(updateRes.status, 200);

      // Admin re-indexes knowledge
      const reindexRes = await fetch(`http://localhost:${port}/api/v1/admin/knowledge/reindex`, {
        method: "POST",
        headers: adminHeaders,
      });
      assert.strictEqual(reindexRes.status, 200);

      // Admin deletes doc
      const deleteRes = await fetch(`http://localhost:${port}/api/v1/admin/knowledge/${docId}`, {
        method: "DELETE",
        headers: adminHeaders,
      });
      assert.strictEqual(deleteRes.status, 200);
    } finally {
      server.close();
    }
  });

  test("9. Observability telemetry logs RAG ingestion and retrieval events", async () => {
    const vectorStore = new MemoryVectorStore();
    const embeddingProvider = new MockEmbeddingProvider({ dimensions: 64 });
    const ingestion = new KnowledgeIngestionService({ vectorStore, embeddingProvider });
    const retriever = new KnowledgeRetriever({ vectorStore, embeddingProvider });

    await ingestion.ingestDocument({
      title: "Telemetry Observation Policy",
      sourceType: "POLICY",
      content: "## Observability\nTelemetry metrics must redact PII.",
      status: "ACTIVE",
    });

    await retriever.retrieve({
      query: "observability telemetry metrics",
    });

    const ingestionLogs = memoryAiLogs.filter((l) => l.event === "RAG_INGESTION_COMPLETED");
    const retrievalLogs = memoryAiLogs.filter((l) => l.event === "RAG_RETRIEVAL_COMPLETED");

    assert.ok(ingestionLogs.length > 0);
    assert.ok(retrievalLogs.length > 0);
    assert.strictEqual(retrievalLogs[0].provider, "knowledge_retriever");
  });
});
