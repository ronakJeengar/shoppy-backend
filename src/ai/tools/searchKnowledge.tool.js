import { AITool } from "./base.tool.js";
import { defaultKnowledgeRetriever } from "../rag/knowledgeRetriever.js";

export class SearchKnowledgeTool extends AITool {
  constructor(retriever = defaultKnowledgeRetriever) {
    super({
      name: "search_knowledge",
      description:
        "Search authoritative store policies, customer service guidelines, FAQs, warranty, and return terms using grounded retrieval.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The specific policy or informational question to search (e.g. 'return window for electronics', 'free shipping rules')",
          },
          sourceType: {
            type: "string",
            enum: ["POLICY", "FAQ", "PRODUCT_GUIDE", "SUPPORT"],
            description: "Optional knowledge category filter",
          },
          topK: {
            type: "integer",
            description: "Maximum number of grounded knowledge passages to return (1-5)",
          },
        },
        required: ["query"],
      },
      requiresAuth: false,
    });
    this.retriever = retriever;
  }

  async execute({ query, sourceType, topK = 3 }, context = {}) {
    if (!query || typeof query !== "string" || !query.trim()) {
      return { found: false, count: 0, results: [] };
    }

    const maxK = Math.min(5, Math.max(1, parseInt(topK, 10) || 3));
    const results = await this.retriever.retrieve({
      query: query.trim(),
      sourceType,
      topK: maxK,
      user: context.user || null,
    });

    return {
      found: results.length > 0,
      count: results.length,
      results: results.map((r) => ({
        chunkId: r.chunkId,
        title: r.title,
        section: r.section,
        sourceType: r.sourceType,
        content: r.content,
        citation: r.citation,
      })),
    };
  }
}
