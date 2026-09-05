import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Product } from "../../models/product.model.js";
import { memoryAdminStore } from "../../controllers/admin.controller.js";

export class SearchProductsTool extends AITool {
  constructor() {
    super({
      name: "search_products",
      description:
        "Search the active store product catalog by keyword, optional category, or maximum price.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search keywords (e.g. 'wireless headphones')",
          },
          category: {
            type: "string",
            description: "Product category name if specified",
          },
          maxPrice: {
            type: "number",
            description: "Optional upper budget price limit",
          },
          limit: {
            type: "integer",
            description: "Maximum number of results to return (default 5, max 10)",
          },
        },
        required: ["query"],
      },
      requiresAuth: false,
    });
  }

  async execute({ query, category, maxPrice, limit = 5 }, context) {
    const maxResults = Math.min(10, Math.max(1, parseInt(limit, 10) || 5));
    const term = String(query || "").trim().toLowerCase();

    if (mongoose.connection.readyState === 1) {
      const filter = { isActive: true };
      if (term) {
        filter.$or = [
          { productName: { $regex: term, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
        ];
      }
      if (maxPrice && !isNaN(Number(maxPrice))) {
        filter.price = { $lte: Number(maxPrice) };
      }

      const products = await Product.find(filter)
        .limit(maxResults)
        .select("productName price stock productRating description sellerName productImage")
        .lean();

      return {
        count: products.length,
        results: products.map((p) => ({
          id: p._id.toString(),
          name: p.productName,
          price: p.price,
          inStock: p.stock > 0,
          stockCount: p.stock,
          rating: p.productRating || 0,
          seller: p.sellerName,
          productImage: p.productImage || "",
          description: p.description || "",
        })),
      };
    } else {
      // In-memory offline / test store fallback
      let filtered = memoryAdminStore.products.filter((p) => p.isActive !== false);

      if (term) {
        filtered = filtered.filter(
          (p) =>
            p.productName?.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term)
        );
      }

      if (maxPrice && !isNaN(Number(maxPrice))) {
        filtered = filtered.filter((p) => p.price <= Number(maxPrice));
      }

      const sliced = filtered.slice(0, maxResults);
      return {
        count: sliced.length,
        results: sliced.map((p) => ({
          id: (p._id || p.id).toString(),
          name: p.productName,
          price: p.price,
          inStock: (p.stock || 0) > 0,
          stockCount: p.stock || 0,
          rating: p.productRating || 0,
          seller: p.sellerName || "Store",
          productImage: p.productImage || "",
          description: p.description || "",
        })),
      };
    }
  }
}
