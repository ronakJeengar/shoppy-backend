import { AITool } from "./base.tool.js";
import { defaultHybridSearchEngine } from "../search/hybridSearchEngine.js";

export class SemanticProductSearchTool extends AITool {
  constructor() {
    super({
      name: "semantic_product_search",
      description:
        "Perform AI semantic & hybrid search over the active catalog using natural language queries and optional filters.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language query (e.g. 'comfortable shoes for running in rain')",
          },
          category: {
            type: "string",
            description: "Optional category filter",
          },
          minPrice: {
            type: "number",
            description: "Optional minimum price",
          },
          maxPrice: {
            type: "number",
            description: "Optional maximum price budget",
          },
          limit: {
            type: "integer",
            description: "Max results to return (default 5, max 10)",
          },
        },
        required: ["query"],
      },
      requiresAuth: false,
      sideEffectType: "READ_ONLY",
      timeout: 4000,
      idempotent: true,
    });
  }

  async execute({ query, category, minPrice, maxPrice, limit = 5 }, context) {
    const limitNum = Math.min(10, Math.max(1, parseInt(limit, 10) || 5));

    const result = await defaultHybridSearchEngine.search({
      query,
      category,
      minPrice,
      maxPrice,
      limit: limitNum,
      inStock: true,
    });

    const formatted = (result.products || []).map((p) => ({
      id: (p._id || p.id).toString(),
      name: p.productName || p.name,
      price: p.price,
      rating: p.productRating || p.rating || 0,
      seller: p.sellerName || p.seller || "Shoppy Verified",
      inStock: p.stock > 0,
      stockCount: p.stock,
      productImage: p.productImage || "",
      description: (p.description || "").substring(0, 160),
    }));

    return {
      query,
      totalMatches: formatted.length,
      searchMode: result.metadata?.searchMode || "hybrid",
      results: formatted,
    };
  }
}
