import mongoose from "mongoose";
import { Review } from "../models/review.model.js";
import { Product } from "../models/product.model.js";
import { Order } from "../models/order.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAdminAction } from "../utils/auditLogger.js";
import { memoryAdminStore } from "./admin.controller.js";

// In-memory review store for offline / testing mode
export const memoryReviewStore = {
  reviews: [],
};

export const _resetMemoryReviewStore = () => {
  memoryReviewStore.reviews = [];
};

export const formatSafeName = (fullName) => {
  if (!fullName || typeof fullName !== "string") return "Customer";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

// ==========================================
// RATING AGGREGATION HELPER
// ==========================================
export const updateProductRatingAggregate = async (productId) => {
  if (!productId) return;

  try {
    if (mongoose.connection.readyState === 1) {
      const prodObjectId = new mongoose.Types.ObjectId(productId.toString());

      const aggregation = await Review.aggregate([
        {
          $match: {
            product: prodObjectId,
            status: "PUBLISHED",
          },
        },
        {
          $group: {
            _id: "$product",
            totalReviews: { $sum: 1 },
            avgRating: { $avg: "$rating" },
          },
        },
      ]);

      let totalReviews = 0;
      let productRating = 0;

      if (aggregation.length > 0) {
        totalReviews = aggregation[0].totalReviews;
        productRating = Math.round(aggregation[0].avgRating * 10) / 10;
      }

      await Product.findByIdAndUpdate(prodObjectId, {
        productRating,
        totalReviews,
      });
    } else {
      // Offline / testing in-memory aggregation
      const pIdStr = productId.toString();
      const published = memoryReviewStore.reviews.filter(
        (r) =>
          (r.product?._id || r.product?.id || r.product)?.toString() ===
            pIdStr && r.status === "PUBLISHED"
      );

      const totalReviews = published.length;
      let productRating = 0;
      if (totalReviews > 0) {
        const sum = published.reduce((acc, r) => acc + (r.rating || 0), 0);
        productRating = Math.round((sum / totalReviews) * 10) / 10;
      }

      const prod = memoryAdminStore.products.find(
        (p) => (p._id || p.id).toString() === pIdStr
      );
      if (prod) {
        prod.productRating = productRating;
        prod.totalReviews = totalReviews;
      }
    }
  } catch (err) {
    console.error("Failed to update product rating aggregate:", err.message);
  }
};

// ==========================================
// 1. GET PRODUCT REVIEWS & SUMMARY (PUBLIC)
// ==========================================
export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 10, rating, sort = "newest" } = req.query;

  if (!productId) {
    throw new ApiError(400, "Product ID is required");
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new ApiError(400, "Invalid product ID format");
    }

    const prodObjectId = new mongoose.Types.ObjectId(productId);

    // Filter for paginated reviews
    const filter = {
      product: prodObjectId,
      status: "PUBLISHED",
    };

    if (rating && !isNaN(parseInt(rating, 10))) {
      const r = parseInt(rating, 10);
      if (r >= 1 && r <= 5) {
        filter.rating = r;
      }
    }

    // Sort order
    let sortObj = { createdAt: -1 };
    if (sort === "highest") {
      sortObj = { rating: -1, createdAt: -1 };
    } else if (sort === "lowest") {
      sortObj = { rating: 1, createdAt: -1 };
    }

    // Parallel execution for pagination & full rating distribution
    const [total, rawReviews, distributionResult] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate("user", "fullName")
        .lean(),
      Review.aggregate([
        {
          $match: {
            product: prodObjectId,
            status: "PUBLISHED",
          },
        },
        {
          $group: {
            _id: "$rating",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Build rating distribution: 1 to 5
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalAllReviews = 0;
    let sumRatings = 0;

    for (const item of distributionResult) {
      if (ratingDistribution[item._id] !== undefined) {
        ratingDistribution[item._id] = item.count;
        totalAllReviews += item.count;
        sumRatings += item._id * item.count;
      }
    }

    const averageRating =
      totalAllReviews > 0
        ? Math.round((sumRatings / totalAllReviews) * 10) / 10
        : 0;

    const reviews = rawReviews.map((r) => ({
      id: r._id,
      _id: r._id,
      rating: r.rating,
      title: r.title || "",
      comment: r.comment,
      verifiedPurchase: r.verifiedPurchase !== false,
      authorName: formatSafeName(r.user?.fullName),
      isOwner:
        req.user && r.user?._id
          ? r.user._id.toString() === req.user._id.toString()
          : false,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          reviews,
          summary: {
            averageRating,
            totalReviews: totalAllReviews,
            ratingDistribution,
          },
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Product reviews retrieved successfully"
      )
    );
  } else {
    // In-memory offline fallback
    const pIdStr = productId.toString();
    const allPublished = memoryReviewStore.reviews.filter(
      (r) =>
        (r.product?._id || r.product?.id || r.product)?.toString() === pIdStr &&
        r.status === "PUBLISHED"
    );

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sumRatings = 0;

    for (const r of allPublished) {
      if (ratingDistribution[r.rating] !== undefined) {
        ratingDistribution[r.rating]++;
        sumRatings += r.rating;
      }
    }

    const totalAllReviews = allPublished.length;
    const averageRating =
      totalAllReviews > 0
        ? Math.round((sumRatings / totalAllReviews) * 10) / 10
        : 0;

    let filtered = [...allPublished];
    if (rating && !isNaN(parseInt(rating, 10))) {
      const r = parseInt(rating, 10);
      filtered = filtered.filter((rev) => rev.rating === r);
    }

    if (sort === "highest") {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (sort === "lowest") {
      filtered.sort((a, b) => a.rating - b.rating);
    } else {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const paged = filtered.slice(skip, skip + limitNum);

    const reviews = paged.map((r) => ({
      id: r._id || r.id,
      _id: r._id || r.id,
      rating: r.rating,
      title: r.title || "",
      comment: r.comment,
      verifiedPurchase: r.verifiedPurchase !== false,
      authorName: formatSafeName(r.user?.fullName || r.authorName),
      isOwner:
        req.user && (r.user?._id || r.user?.id || r.user)
          ? (r.user?._id || r.user?.id || r.user).toString() ===
            req.user._id.toString()
          : false,
      createdAt: r.createdAt || new Date(),
      updatedAt: r.updatedAt || new Date(),
    }));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          reviews,
          summary: {
            averageRating,
            totalReviews: totalAllReviews,
            ratingDistribution,
          },
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Product reviews retrieved successfully"
      )
    );
  }
});

// ==========================================
// 2. CHECK REVIEW ELIGIBILITY (AUTH)
// ==========================================
export const getReviewEligibility = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  if (!productId) {
    throw new ApiError(400, "Product ID is required");
  }

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new ApiError(400, "Invalid product ID format");
    }

    const [existingReview, deliveredOrder] = await Promise.all([
      Review.findOne({
        product: productId,
        user: userId,
      }).lean(),
      Order.findOne({
        customer: userId,
        status: "DELIVERED",
        "orderItems.productId": productId,
      }).lean(),
    ]);

    if (existingReview) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            canReview: false,
            hasReviewed: true,
            isVerifiedPurchase: true,
            existingReview: {
              id: existingReview._id,
              rating: existingReview.rating,
              title: existingReview.title,
              comment: existingReview.comment,
            },
          },
          "You have already reviewed this product"
        )
      );
    }

    if (!deliveredOrder) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            canReview: false,
            hasReviewed: false,
            isVerifiedPurchase: false,
            reason:
              "Only verified purchasers who have received this product can write a review.",
          },
          "User has not purchased and received this product"
        )
      );
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          canReview: true,
          hasReviewed: false,
          isVerifiedPurchase: true,
          orderId: deliveredOrder._id,
        },
        "User is eligible to review this product"
      )
    );
  } else {
    // Offline / testing store
    const existing = memoryReviewStore.reviews.find(
      (r) =>
        (r.product?._id || r.product?.id || r.product)?.toString() ===
          productId.toString() &&
        (r.user?._id || r.user?.id || r.user)?.toString() === userId.toString()
    );

    if (existing) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            canReview: false,
            hasReviewed: true,
            isVerifiedPurchase: true,
            existingReview: {
              id: existing._id || existing.id,
              rating: existing.rating,
              title: existing.title,
              comment: existing.comment,
            },
          },
          "You have already reviewed this product"
        )
      );
    }

    const deliveredOrder = memoryAdminStore.orders.find(
      (o) =>
        (o.customer?._id || o.customer?.id || o.customer)?.toString() ===
          userId.toString() &&
        o.status === "DELIVERED" &&
        o.orderItems?.some(
          (item) =>
            (item.productId?._id || item.productId?.id || item.productId)?.toString() ===
            productId.toString()
        )
    );

    if (!deliveredOrder) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            canReview: false,
            hasReviewed: false,
            isVerifiedPurchase: false,
            reason:
              "Only verified purchasers who have received this product can write a review.",
          },
          "User has not purchased and received this product"
        )
      );
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          canReview: true,
          hasReviewed: false,
          isVerifiedPurchase: true,
          orderId: deliveredOrder._id || deliveredOrder.id,
        },
        "User is eligible to review this product"
      )
    );
  }
});

// ==========================================
// 3. CREATE PRODUCT REVIEW (AUTH)
// ==========================================
export const createProductReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, title = "", comment } = req.body;
  const userId = req.user._id;

  if (!productId) {
    throw new ApiError(400, "Product ID is required");
  }

  // 1. Validate Rating
  const r = parseInt(rating, 10);
  if (isNaN(r) || r < 1 || r > 5 || !Number.isInteger(Number(rating))) {
    throw new ApiError(400, "Valid integer rating between 1 and 5 is required");
  }

  // 2. Validate Comment
  if (!comment || !comment.trim() || comment.trim().length < 3) {
    throw new ApiError(400, "Review comment must be at least 3 characters");
  }
  if (comment.trim().length > 1000) {
    throw new ApiError(400, "Review comment cannot exceed 1000 characters");
  }

  let createdReview = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new ApiError(400, "Invalid product ID format");
    }

    const product = await Product.findById(productId);
    if (!product || product.isActive === false) {
      throw new ApiError(404, "Product not found or is no longer active");
    }

    // 3. Check for Duplicate Review (1 per user per product)
    const existing = await Review.findOne({ product: productId, user: userId });
    if (existing) {
      throw new ApiError(409, "Conflict: You have already reviewed this product");
    }

    // 4. Verify Purchase Eligibility (Delivered Order Containing Item)
    const deliveredOrder = await Order.findOne({
      customer: userId,
      status: "DELIVERED",
      "orderItems.productId": productId,
    });

    if (!deliveredOrder) {
      throw new ApiError(
        403,
        "Forbidden: Only verified purchasers who have received this product can write a review"
      );
    }

    const newReview = await Review.create({
      product: productId,
      user: userId,
      order: deliveredOrder._id,
      rating: r,
      title: title.trim().slice(0, 100),
      comment: comment.trim(),
      status: "PUBLISHED",
      verifiedPurchase: true,
    });

    // Update Product Rating Aggregate
    await updateProductRatingAggregate(productId);

    createdReview = await Review.findById(newReview._id)
      .populate("user", "fullName")
      .lean();
  } else {
    // Offline / testing store
    const pIdStr = productId.toString();
    const existing = memoryReviewStore.reviews.find(
      (rev) =>
        (rev.product?._id || rev.product?.id || rev.product)?.toString() ===
          pIdStr &&
        (rev.user?._id || rev.user?.id || rev.user)?.toString() ===
          userId.toString()
    );

    if (existing) {
      throw new ApiError(409, "Conflict: You have already reviewed this product");
    }

    const deliveredOrder = memoryAdminStore.orders.find(
      (o) =>
        (o.customer?._id || o.customer?.id || o.customer)?.toString() ===
          userId.toString() &&
        o.status === "DELIVERED" &&
        o.orderItems?.some(
          (item) =>
            (item.productId?._id || item.productId?.id || item.productId)?.toString() ===
            pIdStr
        )
    );

    if (!deliveredOrder) {
      throw new ApiError(
        403,
        "Forbidden: Only verified purchasers who have received this product can write a review"
      );
    }

    const id = new mongoose.Types.ObjectId().toString();
    createdReview = {
      _id: id,
      id,
      product: pIdStr,
      user: { _id: userId, fullName: req.user.fullName || "Test User" },
      order: deliveredOrder._id || deliveredOrder.id,
      rating: r,
      title: title.trim().slice(0, 100),
      comment: comment.trim(),
      status: "PUBLISHED",
      verifiedPurchase: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryReviewStore.reviews.unshift(createdReview);
    await updateProductRatingAggregate(productId);
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        id: createdReview._id,
        rating: createdReview.rating,
        title: createdReview.title,
        comment: createdReview.comment,
        verifiedPurchase: true,
        authorName: formatSafeName(createdReview.user?.fullName),
        createdAt: createdReview.createdAt,
      },
      "Review submitted successfully"
    )
  );
});

// ==========================================
// 4. UPDATE REVIEW (AUTH & OWNERSHIP)
// ==========================================
export const updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, title, comment } = req.body;
  const userId = req.user._id;

  if (!id) throw new ApiError(400, "Review ID is required");

  if (rating !== undefined) {
    const r = parseInt(rating, 10);
    if (isNaN(r) || r < 1 || r > 5 || !Number.isInteger(Number(rating))) {
      throw new ApiError(400, "Rating must be an integer between 1 and 5");
    }
  }

  if (comment !== undefined) {
    if (!comment.trim() || comment.trim().length < 3) {
      throw new ApiError(400, "Review comment must be at least 3 characters");
    }
    if (comment.trim().length > 1000) {
      throw new ApiError(400, "Review comment cannot exceed 1000 characters");
    }
  }

  let updatedReview = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid review ID format");
    }

    const review = await Review.findById(id);
    if (!review) throw new ApiError(404, "Review not found");

    // IDOR Ownership Enforcement
    if (review.user.toString() !== userId.toString()) {
      throw new ApiError(403, "Forbidden: You cannot modify another user's review");
    }

    if (rating !== undefined) review.rating = parseInt(rating, 10);
    if (title !== undefined) review.title = title.trim().slice(0, 100);
    if (comment !== undefined) review.comment = comment.trim();

    await review.save();
    await updateProductRatingAggregate(review.product);

    updatedReview = await Review.findById(id).populate("user", "fullName").lean();
  } else {
    const idx = memoryReviewStore.reviews.findIndex(
      (r) => (r._id || r.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "Review not found");

    const review = memoryReviewStore.reviews[idx];
    const ownerId = (review.user?._id || review.user?.id || review.user)?.toString();

    if (ownerId !== userId.toString()) {
      throw new ApiError(403, "Forbidden: You cannot modify another user's review");
    }

    if (rating !== undefined) review.rating = parseInt(rating, 10);
    if (title !== undefined) review.title = title.trim().slice(0, 100);
    if (comment !== undefined) review.comment = comment.trim();
    review.updatedAt = new Date();

    updatedReview = review;
    await updateProductRatingAggregate(review.product);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        id: updatedReview._id || updatedReview.id,
        rating: updatedReview.rating,
        title: updatedReview.title,
        comment: updatedReview.comment,
        verifiedPurchase: updatedReview.verifiedPurchase !== false,
        authorName: formatSafeName(updatedReview.user?.fullName),
        updatedAt: updatedReview.updatedAt,
      },
      "Review updated successfully"
    )
  );
});

// ==========================================
// 5. DELETE REVIEW (AUTH & OWNERSHIP OR ADMIN)
// ==========================================
export const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const isAdmin = req.user.role === "ADMIN";

  if (!id) throw new ApiError(400, "Review ID is required");

  let productId = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid review ID format");
    }

    const review = await Review.findById(id);
    if (!review) throw new ApiError(404, "Review not found");

    // IDOR check: must be owner or admin
    if (review.user.toString() !== userId.toString() && !isAdmin) {
      throw new ApiError(403, "Forbidden: You cannot delete another user's review");
    }

    productId = review.product;
    await Review.findByIdAndDelete(id);
    await updateProductRatingAggregate(productId);

    if (isAdmin) {
      await logAdminAction({
        req,
        action: "REVIEW_DELETED",
        resourceType: "PRODUCT",
        resourceId: productId,
        details: { reviewId: id, deletedBy: "ADMIN" },
      });
    }
  } else {
    const idx = memoryReviewStore.reviews.findIndex(
      (r) => (r._id || r.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "Review not found");

    const review = memoryReviewStore.reviews[idx];
    const ownerId = (review.user?._id || review.user?.id || review.user)?.toString();

    if (ownerId !== userId.toString() && !isAdmin) {
      throw new ApiError(403, "Forbidden: You cannot delete another user's review");
    }

    productId = review.product;
    memoryReviewStore.reviews.splice(idx, 1);
    await updateProductRatingAggregate(productId);

    if (isAdmin) {
      await logAdminAction({
        req,
        action: "REVIEW_DELETED",
        resourceType: "PRODUCT",
        resourceId: productId,
        details: { reviewId: id, deletedBy: "ADMIN" },
      });
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { id }, "Review deleted successfully"));
});

// ==========================================
// 6. ADMIN: GET ALL REVIEWS (MODERATION)
// ==========================================
export const getAdminReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status = "ALL", search, productId } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  if (mongoose.connection.readyState === 1) {
    const filter = {};

    if (status && status !== "ALL") {
      filter.status = status.toUpperCase();
    }

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      filter.product = new mongoose.Types.ObjectId(productId);
    }

    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(sanitized, "i");
      filter.$or = [{ title: regex }, { comment: regex }];
    }

    const [total, rawReviews] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("user", "fullName email")
        .populate("product", "productName productImage")
        .lean(),
    ]);

    const reviews = rawReviews.map((r) => ({
      id: r._id,
      _id: r._id,
      rating: r.rating,
      title: r.title || "",
      comment: r.comment,
      status: r.status,
      verifiedPurchase: r.verifiedPurchase !== false,
      user: r.user
        ? { id: r.user._id, fullName: r.user.fullName, email: r.user.email }
        : null,
      product: r.product
        ? {
            id: r.product._id,
            name: r.product.productName,
            image: r.product.productImage,
          }
        : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          reviews,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Admin reviews retrieved successfully"
      )
    );
  } else {
    let filtered = [...memoryReviewStore.reviews];

    if (status && status !== "ALL") {
      filtered = filtered.filter((r) => r.status === status.toUpperCase());
    }

    if (productId) {
      filtered = filtered.filter(
        (r) =>
          (r.product?._id || r.product?.id || r.product)?.toString() ===
          productId.toString()
      );
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.comment?.toLowerCase().includes(term) ||
          r.title?.toLowerCase().includes(term)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const paged = filtered.slice(skip, skip + limitNum);

    const reviews = paged.map((r) => ({
      id: r._id || r.id,
      _id: r._id || r.id,
      rating: r.rating,
      title: r.title || "",
      comment: r.comment,
      status: r.status,
      verifiedPurchase: r.verifiedPurchase !== false,
      user: r.user || { fullName: "Test User", email: "user@example.com" },
      product: r.product || { name: "Test Product" },
      createdAt: r.createdAt || new Date(),
      updatedAt: r.updatedAt || new Date(),
    }));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          reviews,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Admin reviews retrieved successfully"
      )
    );
  }
});

// ==========================================
// 7. ADMIN: UPDATE REVIEW STATUS (MODERATION)
// ==========================================
export const updateReviewStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!id) throw new ApiError(400, "Review ID is required");
  if (!status || !["PUBLISHED", "HIDDEN"].includes(status.trim().toUpperCase())) {
    throw new ApiError(400, "Valid status is required: PUBLISHED or HIDDEN");
  }

  const targetStatus = status.trim().toUpperCase();
  let productId = null;
  let updated = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid review ID format");
    }

    const review = await Review.findById(id);
    if (!review) throw new ApiError(404, "Review not found");

    const previousStatus = review.status;
    review.status = targetStatus;
    await review.save();

    productId = review.product;
    await updateProductRatingAggregate(productId);

    await logAdminAction({
      req,
      action: "REVIEW_STATUS_UPDATED",
      resourceType: "PRODUCT",
      resourceId: productId,
      details: {
        reviewId: id,
        previousStatus,
        newStatus: targetStatus,
        reason: reason || "Administrative moderation",
      },
    });

    updated = review;
  } else {
    const idx = memoryReviewStore.reviews.findIndex(
      (r) => (r._id || r.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "Review not found");

    const review = memoryReviewStore.reviews[idx];
    const previousStatus = review.status;
    review.status = targetStatus;
    review.updatedAt = new Date();

    productId = review.product;
    await updateProductRatingAggregate(productId);

    await logAdminAction({
      req,
      action: "REVIEW_STATUS_UPDATED",
      resourceType: "PRODUCT",
      resourceId: productId,
      details: {
        reviewId: id,
        previousStatus,
        newStatus: targetStatus,
        reason: reason || "Administrative moderation",
      },
    });

    updated = review;
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        id: updated._id || updated.id,
        status: targetStatus,
      },
      `Review status updated to ${targetStatus}`
    )
  );
});
