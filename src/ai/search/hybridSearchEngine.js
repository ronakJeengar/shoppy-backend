import mongoose from "mongoose";
import { aiConfig, isFeatureEnabled } from "../config/ai.config.js";
import { defaultProductSearchIndex } from "./productSearchIndex.js";
import { QueryProcessor } from "./queryProcessor.js";
import { Product } from "../../models/product.model.js";
import { memoryAdminStore } from "../../controllers/admin.controller.js";
import { logSearchEvent } from "../observability/aiLogger.js";

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Calculates a lexical relevance score [0.0 to 1.0] for a product given a clean search query.
 */
const calculateLexicalScore = (product, cleanQuery) => {
  if (!cleanQuery) return 0;
  const q = cleanQuery.toLowerCase().trim();
  const name = (product.productName || product.name || "").toLowerCase();
  const desc = (product.description || "").toLowerCase();
  const seller = (product.sellerName || "").toLowerCase();

  // Exact match on product title
  if (name === q) return 1.0;
  // Title starts with query
  if (name.startsWith(q)) return 0.85;
  // Title contains exact phrase
  if (name.includes(q)) return 0.7;

  // Individual keyword token matches
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return 0;

  let matchedTokens = 0;
  for (const token of tokens) {
    if (name.includes(token)) {
      matchedTokens += 1;
    } else if (desc.includes(token) || seller.includes(token)) {
      matchedTokens += 0.5;
    }
  }

  return Math.min(0.65, (matchedTokens / tokens.length) * 0.65);
};

export class HybridSearchEngine {
  constructor({ searchIndex = defaultProductSearchIndex } = {}) {
    this.searchIndex = searchIndex;
  }

  /**
   * Primary entry point for hybrid product search.
   */
  async search({
    query = "",
    category,
    minPrice,
    maxPrice,
    minRating,
    inStock,
    sort = "newest",
    page = 1,
    limit = 20,
    fallbackProducts = [],
  } = {}) {
    const startTime = Date.now();
    const rawQuery = String(query || "").trim();

    // 1. Process Natural Language Query for Constraints
    const processed = QueryProcessor.process(rawQuery);

    // Merge explicit HTTP query parameters with extracted natural language constraints
    let effectiveMaxPrice;
    if (maxPrice !== undefined && !isNaN(parseFloat(maxPrice))) {
      effectiveMaxPrice = parseFloat(maxPrice);
    } else if (processed.extractedFilters.maxPrice !== undefined) {
      effectiveMaxPrice = processed.extractedFilters.maxPrice;
    }

    let effectiveMinPrice;
    if (minPrice !== undefined && !isNaN(parseFloat(minPrice))) {
      effectiveMinPrice = parseFloat(minPrice);
    } else if (processed.extractedFilters.minPrice !== undefined) {
      effectiveMinPrice = processed.extractedFilters.minPrice;
    }

    const effectiveInStock =
      inStock === "true" ||
      inStock === true ||
      inStock === "1" ||
      processed.extractedFilters.inStock === true;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // 2. Check if Semantic Search is Enabled & Available
    const isSemanticConfigured = isFeatureEnabled("semanticSearchEnabled");

    let semanticMap = new Map();
    let semanticAttempted = false;
    let fallbackUsed = false;

    if (isSemanticConfigured && rawQuery) {
      semanticAttempted = true;
      try {
        // Enforce 2-second timeout on semantic candidate retrieval
        const candidates = await Promise.race([
          this.searchIndex.searchCandidates(processed.semanticQuery, { topK: 50 }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Semantic search candidate retrieval timeout")), 2000)
          ),
        ]);

        const threshold = aiConfig.retrieval?.similarityThreshold || 0.35;
        for (const candidate of candidates) {
          if (candidate.score >= threshold) {
            semanticMap.set(String(candidate.productId), candidate.score);
          }
        }
      } catch (err) {
        console.warn("HybridSearchEngine: semantic retrieval failed, falling back:", err.message);
        fallbackUsed = true;
        semanticMap.clear();
      }
    }

    // 3. Retrieve Candidate Products from Authoritative Database
    let candidateProducts = [];

    if (mongoose.connection.readyState === 1) {
      // Live MongoDB database mode
      const filter = { isActive: true };

      // Apply category filter if specified
      if (category && category.trim()) {
        const cat = category.trim();
        if (mongoose.Types.ObjectId.isValid(cat)) {
          filter.category = new mongoose.Types.ObjectId(cat);
        }
      }

      // Keyword and Semantic ID candidate filtering
      if (rawQuery) {
        const orClauses = [];

        // Keyword regex match
        const sanitized = escapeRegex(processed.cleanQuery || rawQuery);
        const searchRegex = new RegExp(sanitized, "i");
        orClauses.push(
          { productName: searchRegex },
          { description: searchRegex },
          { sellerName: searchRegex }
        );

        // Include semantic candidate IDs if available
        if (semanticMap.size > 0) {
          const semanticIds = Array.from(semanticMap.keys())
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .map((id) => new mongoose.Types.ObjectId(id));

          if (semanticIds.length > 0) {
            orClauses.push({ _id: { $in: semanticIds } });
          }
        }

        filter.$or = orClauses;
      }

      // Authoritative commercial filters
      if (effectiveMinPrice !== undefined || effectiveMaxPrice !== undefined) {
        filter.price = {};
        if (effectiveMinPrice !== undefined) filter.price.$gte = effectiveMinPrice;
        if (effectiveMaxPrice !== undefined) filter.price.$lte = effectiveMaxPrice;
      }

      if (minRating !== undefined && !isNaN(parseFloat(minRating))) {
        filter.productRating = { $gte: parseFloat(minRating) };
      }

      if (effectiveInStock) {
        filter.stock = { $gt: 0 };
      }

      candidateProducts = await Product.find(filter)
        .populate("category", "name")
        .lean();
    } else {
      // In-Memory / Test Mode Fallback
      const storeProducts =
        memoryAdminStore.products.length > 0
          ? memoryAdminStore.products
          : fallbackProducts;

      candidateProducts = storeProducts.filter((p) => {
        // Enforce visibility: only active products
        if (p.isActive === false) return false;

        // Category filter
        if (category && category.trim()) {
          const cat = category.trim().toLowerCase();
          const pCatId = (p.category?._id || p.category?.id || p.category)?.toString().toLowerCase();
          const pCatName = (p.category?.name || "").toLowerCase();
          if (pCatId !== cat && pCatName !== cat) return false;
        }

        // Authoritative Price bounds
        if (effectiveMinPrice !== undefined && p.price < effectiveMinPrice) return false;
        if (effectiveMaxPrice !== undefined && p.price > effectiveMaxPrice) return false;

        // Rating bounds
        if (minRating !== undefined && !isNaN(parseFloat(minRating))) {
          if ((p.productRating || 0) < parseFloat(minRating)) return false;
        }

        // Stock availability
        if (effectiveInStock && (p.stock || 0) <= 0) return false;

        // Query matching: matches keyword OR matches semantic candidate
        if (rawQuery) {
          const pId = String(p._id || p.id);
          const hasSemanticMatch = semanticMap.has(pId);

          const term = (processed.cleanQuery || rawQuery).toLowerCase();
          const hasKeywordMatch =
            (p.productName || "").toLowerCase().includes(term) ||
            (p.description || "").toLowerCase().includes(term) ||
            (p.sellerName || "").toLowerCase().includes(term);

          if (!hasSemanticMatch && !hasKeywordMatch) {
            return false;
          }
        }

        return true;
      });
    }

    // 4. Calculate Hybrid Ranking Scores
    const rankedProducts = candidateProducts.map((p) => {
      const pId = String(p._id || p.id);
      const semanticScore = semanticMap.get(pId) || 0;
      const lexicalScore = calculateLexicalScore(p, processed.cleanQuery || rawQuery);

      // Balanced hybrid formula: 60% semantic, 40% lexical
      let combinedScore;
      if (semanticAttempted && !fallbackUsed && semanticMap.size > 0) {
        combinedScore = semanticScore * 0.6 + lexicalScore * 0.4;
      } else {
        combinedScore = lexicalScore;
      }

      return {
        ...p,
        _combinedScore: combinedScore,
      };
    });

    // 5. Apply Sorting
    if (sort === "price_asc") {
      rankedProducts.sort((a, b) => a.price - b.price);
    } else if (sort === "price_desc") {
      rankedProducts.sort((a, b) => b.price - a.price);
    } else if (sort === "rating") {
      rankedProducts.sort((a, b) => (b.productRating || 0) - (a.productRating || 0));
    } else if (rawQuery) {
      // Relevance sort by combined hybrid score, then newest
      rankedProducts.sort((a, b) => {
        if (Math.abs(b._combinedScore - a._combinedScore) > 0.05) {
          return b._combinedScore - a._combinedScore;
        }
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } else {
      // Default: newest first
      rankedProducts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    // 6. Paginate Results
    const total = rankedProducts.length;
    const paged = rankedProducts.slice(skip, skip + limitNum);

    const products = paged.map((p) => ({
      id: p._id || p.id,
      _id: p._id || p.id,
      productName: p.productName || p.name,
      name: p.productName || p.name,
      sellerName: p.sellerName || "Store Seller",
      description: p.description || "",
      price: p.price,
      stock: p.stock,
      productRating: p.productRating || 0,
      productImage: p.productImage,
      imageUrl: p.productImage,
      category: p.category
        ? {
            id: p.category._id || p.category.id || p.category,
            _id: p.category._id || p.category.id || p.category,
            name: typeof p.category === "object" ? p.category.name : "Category",
          }
        : null,
      createdAt: p.createdAt,
    }));

    const durationMs = Date.now() - startTime;

    // 7. Observability Telemetry
    logSearchEvent({
      query: rawQuery,
      searchMode: isSemanticConfigured && !fallbackUsed ? "hybrid" : "keyword",
      candidateCount: candidateProducts.length,
      resultCount: total,
      durationMs,
      fallbackUsed,
      extractedConstraints: processed.extractedFilters,
    });

    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      metadata: {
        searchMode: isSemanticConfigured && !fallbackUsed ? "hybrid" : "keyword",
        fallbackUsed,
        extractedFilters: processed.extractedFilters,
        durationMs,
      },
    };
  }
}

export const defaultHybridSearchEngine = new HybridSearchEngine();
