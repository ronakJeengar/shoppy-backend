import { defaultSemanticCandidateGenerator } from "./candidates/semantic.candidates.js";
import { defaultAffinityCandidateGenerator } from "./candidates/affinity.candidates.js";
import { defaultCoOccurrenceCandidateGenerator } from "./candidates/cooccurrence.candidates.js";
import { defaultTrendingCandidateGenerator } from "./candidates/trending.candidates.js";
import { defaultRecommendationRanker } from "./ranking.service.js";
import { defaultInteractionService } from "./interaction.service.js";
import { recommendationConfig } from "./config/recommendation.config.js";
import { aiLogger } from "../observability/aiLogger.js";

export class RecommendationService {
  constructor({
    semanticGenerator = defaultSemanticCandidateGenerator,
    affinityGenerator = defaultAffinityCandidateGenerator,
    coOccurrenceGenerator = defaultCoOccurrenceCandidateGenerator,
    trendingGenerator = defaultTrendingCandidateGenerator,
    ranker = defaultRecommendationRanker,
    interactionService = defaultInteractionService,
  } = {}) {
    this.semanticGenerator = semanticGenerator;
    this.affinityGenerator = affinityGenerator;
    this.coOccurrenceGenerator = coOccurrenceGenerator;
    this.trendingGenerator = trendingGenerator;
    this.ranker = ranker;
    this.interactionService = interactionService;
  }

  /**
   * Generates Personalized "For You" recommendations.
   * Leverages affinity scores, recently viewed items, and semantic similarity.
   * Gracefully falls back to Trending products for cold-start (new or guest users).
   */
  async getPersonalized({
    userId = null,
    limit = recommendationConfig.defaultLimit,
    excludeProductIds = new Set(),
  } = {}) {
    const startTime = Date.now();
    const boundLimit = Math.min(limit, recommendationConfig.maxLimit);
    const excludeSet = new Set(Array.from(excludeProductIds).map(String));

    let candidates = [];
    let isColdStart = true;
    let userProfile = null;

    if (userId) {
      userProfile = await this.affinityGenerator.buildUserProfile(userId);

      // 1. Behavioral Affinity Candidates
      const affinityCandidates = await this.affinityGenerator.getCandidates(userId, {
        topK: 25,
      });

      // 2. Semantic Similarity from Most Recently Viewed Product
      const recentlyViewed = await this.interactionService.getUserRecentlyViewed(userId, {
        limit: 3,
      });

      let semanticCandidates = [];
      if (recentlyViewed.length > 0) {
        semanticCandidates = await this.semanticGenerator.getCandidates(recentlyViewed[0], {
          topK: 15,
        });
      }

      candidates = [...affinityCandidates, ...semanticCandidates];

      if (candidates.length > 0) {
        isColdStart = false;
      }
    }

    // 3. Cold Start Fallback if user has no behavioral history or is a guest
    if (candidates.length === 0) {
      const trending = await this.trendingGenerator.getCandidates({ limit: 25 });
      candidates = trending.map((c) => ({
        ...c,
        reason: "Trending and popular with Shoppy customers",
      }));
      isColdStart = true;
    }

    const rankedProducts = await this.ranker.rankCandidates(candidates, {
      userProfile,
      limit: boundLimit,
      excludeProductIds: excludeSet,
      recommendationType: "personalized",
    });

    const durationMs = Date.now() - startTime;
    aiLogger.log({
      event: "RECOMMENDATIONS_GENERATED",
      type: "personalized",
      userId,
      isColdStart,
      count: rankedProducts.length,
      durationMs,
    });

    return {
      recommendationType: "personalized",
      products: rankedProducts,
      reason: isColdStart
        ? "Popular items trending across Shoppy"
        : "Curated based on your browsing and shopping history",
      generatedAt: new Date().toISOString(),
      metadata: {
        candidateCount: candidates.length,
        isColdStart,
        durationMs,
        algorithmVersion: "hybrid_v1",
      },
    };
  }

  /**
   * Generates "Similar Products" for a product detail page.
   * Combines semantic vector similarity with category matching.
   */
  async getSimilarProducts(
    productId,
    { limit = 6, excludeProductIds = new Set() } = {}
  ) {
    const startTime = Date.now();
    const boundLimit = Math.min(limit, recommendationConfig.maxLimit);
    const excludeSet = new Set(Array.from(excludeProductIds).map(String));
    excludeSet.add(String(productId)); // Never recommend the product itself

    // 1. Semantic Similarity Candidates
    const candidates = await this.semanticGenerator.getCandidates(productId, {
      topK: 20,
    });

    // 2. Backfill with trending if catalog is small
    if (candidates.length < boundLimit) {
      const trending = await this.trendingGenerator.getCandidates({ limit: 10 });
      for (const t of trending) {
        if (!excludeSet.has(t.productId)) {
          candidates.push({ ...t, reason: "Customers also checked out" });
        }
      }
    }

    const rankedProducts = await this.ranker.rankCandidates(candidates, {
      limit: boundLimit,
      excludeProductIds: excludeSet,
      recommendationType: "similar",
    });

    const durationMs = Date.now() - startTime;
    return {
      recommendationType: "similar",
      productId: String(productId),
      products: rankedProducts,
      reason: "Similar products you might love",
      generatedAt: new Date().toISOString(),
      metadata: {
        candidateCount: candidates.length,
        durationMs,
        algorithmVersion: "semantic_v1",
      },
    };
  }

  /**
   * Generates "Frequently Bought Together" bundle recommendations.
   * Derived from co-purchased order item history.
   */
  async getFrequentlyBoughtTogether(
    productId,
    { limit = 4, excludeProductIds = new Set() } = {}
  ) {
    const startTime = Date.now();
    const boundLimit = Math.min(limit, recommendationConfig.maxLimit);
    const excludeSet = new Set(Array.from(excludeProductIds).map(String));
    excludeSet.add(String(productId));

    const candidates = await this.coOccurrenceGenerator.getCandidates(productId, {
      limit: boundLimit * 2,
    });

    const rankedProducts = await this.ranker.rankCandidates(candidates, {
      limit: boundLimit,
      excludeProductIds: excludeSet,
      recommendationType: "frequently_bought_together",
    });

    const durationMs = Date.now() - startTime;
    return {
      recommendationType: "frequently_bought_together",
      productId: String(productId),
      products: rankedProducts,
      reason: "Frequently bought together with this item",
      generatedAt: new Date().toISOString(),
      metadata: {
        candidateCount: candidates.length,
        durationMs,
        algorithmVersion: "cooccurrence_v1",
      },
    };
  }

  /**
   * Generates Trending/Popular product recommendations.
   */
  async getTrending({
    categoryId = null,
    limit = recommendationConfig.defaultLimit,
    excludeProductIds = new Set(),
  } = {}) {
    const startTime = Date.now();
    const boundLimit = Math.min(limit, recommendationConfig.maxLimit);
    const excludeSet = new Set(Array.from(excludeProductIds).map(String));

    const candidates = await this.trendingGenerator.getCandidates({
      limit: boundLimit * 2,
      categoryId,
    });

    const rankedProducts = await this.ranker.rankCandidates(candidates, {
      limit: boundLimit,
      excludeProductIds: excludeSet,
      recommendationType: "trending",
    });

    const durationMs = Date.now() - startTime;
    return {
      recommendationType: "trending",
      products: rankedProducts,
      reason: "Trending and popular now",
      generatedAt: new Date().toISOString(),
      metadata: {
        candidateCount: candidates.length,
        durationMs,
        algorithmVersion: "trending_v1",
      },
    };
  }

  /**
   * Generates Recently Viewed products for an authenticated user.
   */
  async getRecentlyViewed(userId, { limit = 10 } = {}) {
    const boundLimit = Math.min(limit, recommendationConfig.maxLimit);
    if (!userId) {
      return {
        recommendationType: "recently_viewed",
        products: [],
        reason: "No recently viewed products for guest session",
        generatedAt: new Date().toISOString(),
      };
    }

    const viewedIds = await this.interactionService.getUserRecentlyViewed(userId, {
      limit: boundLimit,
    });

    if (viewedIds.length === 0) {
      return {
        recommendationType: "recently_viewed",
        products: [],
        reason: "No recently viewed products found",
        generatedAt: new Date().toISOString(),
      };
    }

    const productMap = await this.ranker.hydrateAndValidate(viewedIds, {
      requireInStock: false,
    });

    const products = [];
    for (const pid of viewedIds) {
      const p = productMap.get(pid);
      if (p) {
        products.push({
          id: String(p._id || p.id),
          _id: String(p._id || p.id),
          productName: p.productName,
          name: p.productName,
          sellerName: p.sellerName,
          description: p.description || "",
          price: p.price,
          stock: p.stock,
          productRating: p.productRating || 0,
          totalReviews: p.totalReviews || 0,
          productImage: p.productImage,
          imageUrl: p.productImage,
          category: p.category
            ? {
                id: String(p.category._id || p.category),
                _id: String(p.category._id || p.category),
                name: p.category.name || String(p.category),
              }
            : null,
          createdAt: p.createdAt,
          recommendationReason: "Recently viewed by you",
        });
      }
    }

    return {
      recommendationType: "recently_viewed",
      products,
      reason: "Recently viewed by you",
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultRecommendationService = new RecommendationService();
