import mongoose from "mongoose";
import { recommendationConfig } from "./config/recommendation.config.js";
import { Product } from "../../models/product.model.js";

const fallbackProducts = [
  {
    _id: "64f2b1a2b3c4d5e6f7a8b001",
    productName: "Wireless Noise-Cancelling Headphones",
    sellerName: "SoundTech Official",
    description:
      "High-fidelity wireless headphones with dynamic 40mm drivers, active noise cancellation, 30-hour battery life, and comfortable memory foam earcups.",
    price: 149.99,
    stock: 45,
    productRating: 4.8,
    totalReviews: 120,
    productImage:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b002",
    productName: "Smart Fitness Watch Ultra",
    sellerName: "PulseTech Wearables",
    description:
      "Advanced health monitoring smartwatch featuring heart rate tracking, blood oxygen sensor, GPS route tracking, and water resistance up to 50m.",
    price: 199.99,
    stock: 28,
    productRating: 4.6,
    totalReviews: 62,
    productImage:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    createdAt: new Date("2026-01-02T00:00:00Z"),
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b003",
    productName: "Ergonomic Mechanical Keyboard RGB",
    sellerName: "KeyCraft Innovations",
    description:
      "Hot-swappable mechanical gaming and typing keyboard with custom linear switches, PBT keycaps, and customizable per-key RGB backlighting.",
    price: 89.99,
    stock: 60,
    productRating: 4.7,
    totalReviews: 76,
    productImage:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    createdAt: new Date("2026-01-03T00:00:00Z"),
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b004",
    productName: "Ultra-Lightweight Running Shoes",
    sellerName: "AeroStep Athletics",
    description:
      "Breathable mesh running sneakers with responsive foam midsole, shock absorption, and high-traction rubber outsole for long distance runs.",
    price: 79.99,
    stock: 35,
    productRating: 4.4,
    totalReviews: 38,
    productImage:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c002", name: "footwear & apparel" },
    createdAt: new Date("2026-01-04T00:00:00Z"),
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b005",
    productName: "Precision Pour-Over Coffee Dripper",
    sellerName: "Artisan Brewware",
    description:
      "Ceramic pour-over cone designed with spiral ribs for optimal extraction flow rate. Includes reusable stainless steel mesh filter.",
    price: 34.0,
    stock: 50,
    productRating: 4.5,
    totalReviews: 45,
    productImage:
      "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c003", name: "home & kitchen" },
    createdAt: new Date("2026-01-05T00:00:00Z"),
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b006",
    productName: "Pro Insulated Stainless Water Bottle 1L",
    sellerName: "Summit Outdoors",
    description:
      "Double-walled vacuum insulated thermal flask keeping liquids icy cold for 24 hours or steaming hot for 12 hours. BPA-free leakproof lid.",
    price: 24.99,
    stock: 80,
    productRating: 4.9,
    totalReviews: 95,
    productImage:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c004", name: "sports & outdoors" },
    createdAt: new Date("2026-01-06T00:00:00Z"),
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b007",
    productName: "Hardcover Dotted Grid Journal",
    sellerName: "PaperCraft Studio",
    description:
      "Premium 120gsm fountain-pen friendly archival paper, expanding back pocket, dual ribbon bookmarks, and durable vegan leather cover.",
    price: 18.5,
    stock: 90,
    productRating: 4.8,
    totalReviews: 84,
    productImage:
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c005", name: "books & stationery" },
    createdAt: new Date("2026-01-07T00:00:00Z"),
    isActive: true,
  },
];

export class RecommendationRanker {
  /**
   * Hydrates candidate IDs with authoritative, fresh database records.
   * Strips inactive, deleted, or out-of-stock items.
   */
  async hydrateAndValidate(candidateIds, { requireInStock = true } = {}) {
    if (!candidateIds || candidateIds.length === 0) return new Map();

    const idStrings = Array.from(new Set(candidateIds.map(String)));
    const productMap = new Map();

    if (mongoose.connection.readyState === 1) {
      try {
        const validDocs = await Product.find({
          _id: { $in: idStrings },
          isActive: true,
          ...(requireInStock ? { stock: { $gt: 0 } } : {}),
        })
          .populate("category", "name")
          .lean();

        for (const doc of validDocs) {
          productMap.set(String(doc._id), doc);
        }
      } catch (err) {
        console.warn("RecommendationRanker.hydrateAndValidate: Mongo error:", err.message);
      }
    }

    // Fallback hydration for in-memory / testing
    if (productMap.size === 0) {
      for (const p of fallbackProducts) {
        if (
          idStrings.includes(String(p._id)) &&
          p.isActive !== false &&
          (!requireInStock || p.stock > 0)
        ) {
          productMap.set(String(p._id), p);
        }
      }
    }

    return productMap;
  }

  /**
   * Ranks candidates using multi-factor scoring, applies diversity constraints,
   * and formats into standard client-facing product models.
   */
  async rankCandidates(
    rawCandidates = [],
    {
      userProfile = null,
      limit = recommendationConfig.defaultLimit,
      excludeProductIds = new Set(),
      requireInStock = true,
      maxPerCategory = recommendationConfig.diversity.maxPerCategory,
      recommendationType = "personalized",
    } = {}
  ) {
    if (!rawCandidates || rawCandidates.length === 0) {
      return [];
    }

    // 1. Deduplicate candidate list, keeping highest initial score
    const dedupedCandidates = new Map();
    for (const cand of rawCandidates) {
      const pid = String(cand.productId);
      if (excludeProductIds.has(pid)) continue;

      if (!dedupedCandidates.has(pid) || dedupedCandidates.get(pid).score < cand.score) {
        dedupedCandidates.set(pid, cand);
      }
    }

    if (dedupedCandidates.size === 0) return [];

    // 2. Authoritative Database Validation
    const candidateIds = Array.from(dedupedCandidates.keys());
    const validProductMap = await this.hydrateAndValidate(candidateIds, { requireInStock });

    // 3. Multi-Factor Scoring
    const scoredList = [];
    const weights = recommendationConfig.weights;

    for (const [pid, cand] of dedupedCandidates.entries()) {
      const product = validProductMap.get(pid);
      if (!product) continue; // Inactive or out-of-stock product dropped

      const baseScore = cand.score || 0.5;
      const ratingScore = (product.productRating || 4.0) / 5.0;
      const popularityScore = Math.min(1.0, (product.totalReviews || 10) / 100);

      let affinityScore = 0;
      if (userProfile?.categoryScores) {
        const catKey = String(
          product.category?.name || product.category?._id || product.category || ""
        ).toLowerCase();
        if (userProfile.categoryScores.has(catKey)) {
          affinityScore = 1.0;
        }
      }

      // Compute weighted composite score
      const finalScore =
        baseScore * 0.45 +
        affinityScore * weights.affinity +
        popularityScore * weights.popularity +
        ratingScore * weights.rating;

      scoredList.push({
        product,
        finalScore,
        initialScore: baseScore,
        source: cand.source,
        reason: cand.reason || "Recommended based on your preferences",
      });
    }

    // Sort by final score descending
    scoredList.sort((a, b) => b.finalScore - a.finalScore);

    // 4. Diversity Re-ranking: Limit items per category to avoid monoculture
    const diverseList = [];
    const categoryCounts = new Map();
    const deferredList = [];

    for (const item of scoredList) {
      const cat = String(item.product.category?.name || item.product.category || "general").toLowerCase();
      const count = categoryCounts.get(cat) || 0;

      if (count < maxPerCategory) {
        categoryCounts.set(cat, count + 1);
        diverseList.push(item);
      } else {
        deferredList.push(item);
      }

      if (diverseList.length >= limit) break;
    }

    // Backfill from deferred list if diversity quota was too restrictive
    while (diverseList.length < limit && deferredList.length > 0) {
      diverseList.push(deferredList.shift());
    }

    // 5. Format to standard product envelope
    return diverseList.slice(0, limit).map(({ product, finalScore, source, reason }) => ({
      id: String(product._id || product.id),
      _id: String(product._id || product.id),
      productName: product.productName,
      name: product.productName,
      sellerName: product.sellerName,
      description: product.description || "",
      price: product.price,
      stock: product.stock,
      productRating: product.productRating || 0,
      totalReviews: product.totalReviews || 0,
      productImage: product.productImage,
      imageUrl: product.productImage,
      category: product.category
        ? {
            id: String(product.category._id || product.category),
            _id: String(product.category._id || product.category),
            name: product.category.name || String(product.category),
          }
        : null,
      createdAt: product.createdAt,
      recommendationReason: reason,
      score: Math.round(finalScore * 100) / 100,
      source,
    }));
  }
}

export const defaultRecommendationRanker = new RecommendationRanker();
