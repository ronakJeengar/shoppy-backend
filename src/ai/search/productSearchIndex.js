import { MemoryVectorStore } from "../retrieval/memory.vector.store.js";
import { MockEmbeddingProvider } from "../retrieval/embedding.provider.js";
import { buildProductDocument } from "./productDocumentBuilder.js";

/**
 * Product Search Vector Index manager.
 * Handles product indexing, updates, deletions, and dense similarity retrieval.
 */
export class ProductSearchIndex {
  constructor({
    vectorStore = new MemoryVectorStore(),
    embeddingProvider = new MockEmbeddingProvider({ dimensions: 64 }),
  } = {}) {
    this.vectorStore = vectorStore;
    this.embeddingProvider = embeddingProvider;
    this.isInitialized = false;
  }

  /**
   * Index a single product into the vector store.
   * Only active products should be indexed.
   */
  async indexProduct(product) {
    if (!product) return null;

    const id = String(product._id || product.id);
    if (!id) return null;

    // If product is deactivated, remove from vector index
    if (product.isActive === false) {
      await this.removeProduct(id);
      return null;
    }

    const docText = buildProductDocument(product);
    if (!docText.trim()) return null;

    const vector = await this.embeddingProvider.embed(docText);

    let categoryName = "";
    if (product.category) {
      categoryName =
        typeof product.category === "object"
          ? product.category.name || ""
          : String(product.category);
    }

    const metadata = {
      productId: id,
      productName: product.productName || product.name || "",
      category: categoryName.toLowerCase(),
      isActive: true,
      indexedAt: new Date().toISOString(),
    };

    await this.vectorStore.upsert({
      id,
      content: docText,
      metadata,
      vector,
    });

    return id;
  }

  /**
   * Remove a product from the vector index (e.g. on deletion or deactivation).
   */
  async removeProduct(productId) {
    const id = String(productId);
    return await this.vectorStore.delete(id);
  }

  /**
   * Batch index an array of products.
   */
  async indexBatch(products = []) {
    let indexedCount = 0;
    for (const product of products) {
      try {
        const id = await this.indexProduct(product);
        if (id) indexedCount++;
      } catch (err) {
        console.warn(`ProductSearchIndex: failed to index product ${product?._id}:`, err.message);
      }
    }
    this.isInitialized = true;
    return indexedCount;
  }

  /**
   * Performs semantic similarity search across indexed products.
   */
  async searchCandidates(query, { topK = 20, filter = {} } = {}) {
    let queryVector;
    if (typeof query === "string") {
      queryVector = await this.embeddingProvider.embed(query);
    } else {
      queryVector = query;
    }

    const results = await this.vectorStore.search(queryVector, { topK, filter });
    return results.map((r) => ({
      productId: r.id,
      score: r.score,
      metadata: r.metadata,
    }));
  }

  async count() {
    return await this.vectorStore.count();
  }

  async clear() {
    await this.vectorStore.clear();
    this.isInitialized = false;
  }
}

export const defaultProductSearchIndex = new ProductSearchIndex();
