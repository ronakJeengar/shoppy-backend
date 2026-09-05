/**
 * Configuration parameters for the Shoppy Recommendation & Personalization Engine.
 * Configurable weights, decay rates, limits, and diversity thresholds.
 */
export const recommendationConfig = {
  // Feature flag kill-switch
  enabled: true,

  // Default and maximum recommendation limits
  defaultLimit: 10,
  maxLimit: 30,
  candidatePoolSize: 50,

  // Multi-factor ranking weights (sum to 1.0)
  weights: {
    semantic: 0.35,     // Vector similarity to user interests or target product
    affinity: 0.30,     // Category & seller affinity derived from user behavior
    popularity: 0.15,   // Order sales volume & interaction velocity
    rating: 0.10,       // Product quality & verified review rating
    recency: 0.10,      // Freshness of product / recency of user engagement
  },

  // Behavioral interaction weights for user profile affinity
  behaviorWeights: {
    PURCHASE: 5.0,
    ADD_TO_CART: 4.0,
    WISHLIST_ADD: 3.0,
    VIEW_PRODUCT: 1.5,
    SEARCH_CLICK: 1.0,
  },

  // Recency decay half-life in days (lambda = ln(2) / halfLifeDays)
  recencyHalfLifeDays: 14,

  // Diversity & anti-monoculture constraints
  diversity: {
    maxPerCategory: 3,
    maxPerSeller: 3,
  },

  // Cache settings
  cache: {
    ttlSeconds: 300, // 5 minutes cache for anonymous/trending recommendations
  },
};
