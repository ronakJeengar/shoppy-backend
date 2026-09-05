import { defaultVectorStore } from "../retrieval/memory.vector.store.js";
import { MockEmbeddingProvider } from "../retrieval/embedding.provider.js";

const defaultEmbeddingProvider = new MockEmbeddingProvider();

export class ContextBuilder {
  constructor({
    vectorStore = defaultVectorStore,
    embeddingProvider = defaultEmbeddingProvider,
  } = {}) {
    this.vectorStore = vectorStore;
    this.embeddingProvider = embeddingProvider;
  }

  /**
   * Build minimal, privacy-safe, task-scoped context for an AI invocation.
   */
  async buildContext({ query = "", user = null, includeKnowledge = true } = {}) {
    let contextSnippets = [];

    // 1. Safe, minimal user identification (NO passwords, NO payment secrets, NO tokens)
    if (user && user._id) {
      const firstName = (user.fullName || "Customer").split(" ")[0];
      contextSnippets.push(`Authenticated Customer: ${firstName}`);
    }

    // 2. Semantic retrieval from VectorStore if enabled and documents exist
    if (includeKnowledge && query.trim() && (await this.vectorStore.count()) > 0) {
      try {
        const queryVector = await this.embeddingProvider.embed(query);
        const matches = await this.vectorStore.search(queryVector, { topK: 3 });

        if (matches.length > 0) {
          const docsText = matches
            .filter((m) => m.score > 0.3)
            .map((m) => `- [${m.metadata?.category || "Knowledge"}]: ${m.content}`)
            .join("\n");

          if (docsText) {
            contextSnippets.push(`Relevant Knowledge:\n${docsText}`);
          }
        }
      } catch (err) {
        // Semantic retrieval failure is non-blocking
        console.warn("ContextBuilder semantic search fallback:", err.message);
      }
    }

    return contextSnippets.join("\n\n");
  }
}

export const defaultContextBuilder = new ContextBuilder();
