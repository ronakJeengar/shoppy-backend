import mongoose from "mongoose";
import { Coupon } from "../models/coupon.model.js";
import { Cart } from "../models/cart.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  validateAndCalculateCoupon,
  normalizeCouponCode,
  memoryCoupons,
} from "../services/coupon.service.js";
import { memoryCarts } from "./cart.controller.js";

/**
 * Public/Customer endpoint to validate a coupon against user's cart or explicit items.
 * POST /api/v1/coupons/validate
 */
export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, items, subtotal } = req.body;
  const userId = req.user?._id;

  if (!code) {
    throw new ApiError(400, "Coupon code is required", "COUPON_CODE_REQUIRED");
  }

  let cartItems = items;

  // If no items explicitly supplied, load from current user's cart (DB or in-memory)
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    if (userId && mongoose.connection.readyState === 1) {
      const cart = await Cart.findOne({ user: userId }).populate("items.product");
      if (cart && cart.items && cart.items.length > 0) {
        cartItems = cart.items
          .filter((i) => i.product)
          .map((i) => ({
            productId: i.product._id ? i.product._id.toString() : i.product,
            categoryId: i.product.category ? i.product.category.toString() : undefined,
            productName: i.product.productName || "Product",
            price: Number(i.product.price || 0),
            quantity: Number(i.quantity || 1),
            lineTotal: Number(i.product.price || 0) * Number(i.quantity || 1),
          }));
      }
    } else if (userId && memoryCarts && memoryCarts.has(userId.toString())) {
      const memItems = memoryCarts.get(userId.toString()) || [];
      if (memItems.length > 0) {
        cartItems = memItems.map((i) => ({
          productId: i.product?._id || i.product || "prod",
          categoryId: i.product?.category,
          productName: i.product?.productName || "Product",
          price: Number(i.product?.price || 0),
          quantity: Number(i.quantity || 1),
          lineTotal: Number(i.product?.price || 0) * Number(i.quantity || 1),
        }));
      }
    }
  }

  // Fallback: If still no items, but subtotal was passed
  if ((!cartItems || cartItems.length === 0) && subtotal !== undefined) {
    const subNum = Number(subtotal);
    if (!isNaN(subNum) && subNum > 0) {
      cartItems = [
        {
          productId: "subtotal_preview",
          productName: "Cart Items",
          price: subNum,
          quantity: 1,
          lineTotal: subNum,
        },
      ];
    }
  }

  if (!cartItems || cartItems.length === 0) {
    throw new ApiError(
      400,
      "Cannot validate coupon on an empty cart. Please add items first.",
      "EMPTY_CART"
    );
  }

  const result = await validateAndCalculateCoupon({
    code,
    cartItems,
    userId,
    now: new Date(),
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        valid: true,
        coupon: result,
        ...result,
      },
      `Coupon "${result.code}" applied successfully! You save ₹${result.discountAmount.toLocaleString("en-IN")}`
    )
  );
});

/**
 * Public/Customer endpoint to list currently available promo coupons for discovery.
 * GET /api/v1/coupons/available
 */
export const getAvailableCoupons = asyncHandler(async (req, res) => {
  const now = new Date();

  if (mongoose.connection.readyState === 1) {
    const coupons = await Coupon.find({
      isActive: true,
      startAt: { $lte: now },
      expiresAt: { $gte: now },
      $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
    })
      .select(
        "code name description discountType discountValue minimumOrderValue maximumDiscountAmount expiresAt firstOrderOnly"
      )
      .sort({ discountValue: -1 })
      .lean();

    return res.status(200).json(
      new ApiResponse(200, { coupons }, "Available coupons retrieved successfully")
    );
  }

  // Fallback active coupons for offline / tests
  const activeMemoryCoupons = memoryCoupons
    .filter((c) => c.isActive && new Date(c.expiresAt) >= now)
    .map((c) => ({
      code: c.code,
      name: c.name,
      description: c.description,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minimumOrderValue: c.minimumOrderValue,
      maximumDiscountAmount: c.maximumDiscountAmount,
      expiresAt: c.expiresAt,
      firstOrderOnly: c.firstOrderOnly,
    }));

  return res.status(200).json(
    new ApiResponse(200, { coupons: activeMemoryCoupons }, "Available coupons retrieved successfully")
  );
});
