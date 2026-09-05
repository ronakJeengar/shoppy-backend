import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { defaultRecommendationService } from "../ai/recommendations/recommendation.service.js";
import { defaultInteractionService } from "../ai/recommendations/interaction.service.js";
import { isFeatureEnabled } from "../ai/config/ai.config.js";

/**
 * GET /api/v1/recommendations
 * Retrieves recommendations by type:
 * - 'personalized' (Recommended For You)
 * - 'similar' (Similar Products for PDP)
 * - 'frequently_bought_together' (Bundle additions for PDP/Cart)
 * - 'trending' (Popular Products across Shoppy)
 * - 'recently_viewed' (Recently viewed products)
 */
export const getRecommendations = asyncHandler(async (req, res) => {
  const {
    type = "personalized",
    productId,
    categoryId,
    limit = 10,
    exclude,
  } = req.query;

  const parsedLimit = Math.min(30, Math.max(1, parseInt(limit, 10) || 10));
  const userId = req.user?._id ? String(req.user._id) : null;
  const excludeSet = new Set(
    exclude
      ? String(exclude)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : []
  );

  // Kill Switch & Degradation Guard: Fall back gracefully to trending catalog if disabled
  if (!isFeatureEnabled("recommendationsEnabled")) {
    const fallback = await defaultRecommendationService
      .getTrending({
        categoryId: categoryId || null,
        limit: parsedLimit,
        excludeProductIds: excludeSet,
      })
      .catch(() => ({
        recommendationType: "FALLBACK",
        reason: "Popular store items",
        count: 0,
        products: [],
        metadata: { disabled: true },
      }));

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          fallback,
          "Recommendations retrieved successfully (Fallback)"
        )
      );
  }

  let result = null;

  try {
    switch (type.toLowerCase()) {
      case "similar":
        if (!productId) {
          throw new ApiError(400, "productId is required for similar recommendations");
        }
        result = await defaultRecommendationService.getSimilarProducts(productId, {
          limit: parsedLimit,
          excludeProductIds: excludeSet,
        });
        break;

      case "frequently_bought_together":
        if (!productId) {
          throw new ApiError(
            400,
            "productId is required for frequently_bought_together recommendations"
          );
        }
        result = await defaultRecommendationService.getFrequentlyBoughtTogether(productId, {
          limit: parsedLimit,
          excludeProductIds: excludeSet,
        });
        break;

      case "trending":
        result = await defaultRecommendationService.getTrending({
          categoryId: categoryId || null,
          limit: parsedLimit,
          excludeProductIds: excludeSet,
        });
        break;

      case "recently_viewed":
        result = await defaultRecommendationService.getRecentlyViewed(userId, {
          limit: parsedLimit,
        });
        break;

      case "personalized":
      default:
        result = await defaultRecommendationService.getPersonalized({
          userId,
          limit: parsedLimit,
          excludeProductIds: excludeSet,
        });
        break;
    }
  } catch (err) {
    if (err instanceof ApiError && err.statusCode < 500) {
      throw err;
    }
    // Unexpected failure: gracefully degrade to trending products
    result = await defaultRecommendationService
      .getTrending({
        categoryId: categoryId || null,
        limit: parsedLimit,
        excludeProductIds: excludeSet,
      })
      .catch(() => ({
        recommendationType: "FALLBACK",
        reason: "Popular store items",
        count: 0,
        products: [],
        metadata: { degraded: true },
      }));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Recommendations retrieved successfully"));
});

/**
 * POST /api/v1/recommendations/events
 * Ingests user interaction events to improve personalized recommendations.
 */
export const trackEvent = asyncHandler(async (req, res) => {
  const { eventType, productId, categoryId, metadata } = req.body;

  if (!eventType) {
    throw new ApiError(400, "eventType is required");
  }
  if (!productId) {
    throw new ApiError(400, "productId is required");
  }

  const validEventTypes = [
    "VIEW_PRODUCT",
    "SEARCH_CLICK",
    "ADD_TO_CART",
    "REMOVE_FROM_CART",
    "WISHLIST_ADD",
    "WISHLIST_REMOVE",
    "PURCHASE",
  ];

  if (!validEventTypes.includes(eventType)) {
    throw new ApiError(
      400,
      `Invalid eventType. Must be one of: ${validEventTypes.join(", ")}`
    );
  }

  // Identity is strictly server-derived: client cannot claim another user's identity
  const userId = req.user?._id || null;
  const sessionId = req.header("x-session-id") || req.body.sessionId || null;

  const eventRecord = await defaultInteractionService.recordEvent({
    userId,
    sessionId,
    eventType,
    productId,
    categoryId: categoryId || null,
    metadata: metadata || {},
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        recorded: true,
        eventType,
        productId,
        timestamp: eventRecord?.timestamp || new Date(),
      },
      "Interaction event recorded successfully"
    )
  );
});
