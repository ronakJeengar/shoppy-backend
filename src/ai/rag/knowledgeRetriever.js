import mongoose from "mongoose";
import { defaultVectorStore } from "../retrieval/memory.vector.store.js";
import { MockEmbeddingProvider } from "../retrieval/embedding.provider.js";
import { Product } from "../../models/product.model.js";
import { memoryAdminStore } from "../../controllers/admin.controller.js";
import { logRagRetrievalEvent } from "../observability/aiLogger.js";


export class KnowledgeRetriever {
  constructor({
    vectorStore = defaultVectorStore,
    embeddingProvider = new MockEmbeddingProvider({ dimensions: 64 }),
  } = {}) {
    this.vectorStore = vectorStore;
    this.embeddingProvider = embeddingProvider;
  }

  /**
   * Retrieves relevant knowledge chunks grounded by vector similarity,
   * strictly filtered by visibility and validated against authoritative catalog state.
   */
  async retrieve({
    query = "",
    sourceType = null,
    visibility = "PUBLIC",
    topK = 5,
    minScore = 0.35,
    user = null,
  } = {}) {
    const startTime = Date.now();

    if (!query || typeof query !== "string" || !query.trim()) {
      return [];
    }

    // Role-based visibility enforcement
    const isAdmin = user && user.role === "ADMIN";
    const allowedVisibility = isAdmin && visibility ? visibility.toUpperCase() : "PUBLIC";

    // Generate query embedding
    const queryVector = await this.embeddingProvider.embed(query);

    // Retrieve candidates from vector store
    const candidates = await this.vectorStore.search(queryVector, {
      topK: Math.max(topK * 3, 15),
    });

    const validatedResults = [];

    for (const match of candidates) {
      const meta = match.metadata || {};

      // 1. Status Guard: strictly exclude non-ACTIVE documents
      if (meta.status && meta.status !== "ACTIVE") {
        continue;
      }

      // 2. Visibility Guard: non-admins can never access ADMIN knowledge
      if (allowedVisibility !== "ALL") {
        if (meta.visibility && meta.visibility !== allowedVisibility) {
          continue;
        }
      }

      // 3. Source Type Filter
      if (sourceType && meta.sourceType) {
        if (String(meta.sourceType).toUpperCase() !== String(sourceType).toUpperCase()) {
          continue;
        }
      }

      // 4. Similarity Threshold Cutoff (Hallucination Defense)
      if (match.score < minScore) {
        continue;
      }

      // 5. Authoritative Product Catalog Check
      if (meta.productId) {
        try {
          if (mongoose.connection.readyState === 1) {
            const product = await Product.findById(meta.productId).select("isActive price stock");
            if (!product || product.isActive === false) {
              continue; // Exclude unpublished, inactive or deleted products
            }
          } else {
            const product = memoryAdminStore.products.find(
              (p) => String(p._id || p.id) === String(meta.productId)
            );
            if (!product || product.isActive === false) {
              continue;
            }
          }
        } catch (err) {
          continue;
        }
      }


      // 6. Build Structured Attribution / Citation
      validatedResults.push({
        chunkId: meta.chunkId || match.id,
        documentId: meta.documentId || "",
        title: meta.title || meta.documentTitle || "Shoppy Knowledge",
        section: meta.section || "",
        sourceType: meta.sourceType || "POLICY",
        content: match.content,
        score: match.score,
        citation: {
          source: meta.documentTitle || meta.title || "Shoppy Policy",
          section: meta.section || "",
          sourceType: meta.sourceType || "POLICY",
          documentId: meta.documentId || "",
        },
      });

      if (validatedResults.length >= topK) {
        break;
      }
    }

    // Observability Logging
    logRagRetrievalEvent({
      query,
      sourceType,
      visibility: allowedVisibility,
      candidateCount: candidates.length,
      resultCount: validatedResults.length,
      durationMs: Date.now() - startTime,
      success: true,
    });

    return validatedResults;
  }
}

export const defaultKnowledgeRetriever = new KnowledgeRetriever();
