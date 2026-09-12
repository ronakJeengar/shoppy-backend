import mongoose from "mongoose";
import { Coupon } from "../models/coupon.model.js";
import { Order } from "../models/order.model.js";
import { ApiError } from "../utils/apiError.js";

export const memoryCoupons = [
  {
    _id: "coup_welcome10",
    code: "WELCOME10",
    name: "Welcome 10% Off",
    description: "Get 10% off up to ₹250 on your first purchase above ₹499",
    discountType: "PERCENTAGE",
    discountValue: 10,
    minimumOrderValue: 499,
    maximumDiscountAmount: 250,
    startAt: new Date(Date.now() - 86400000),
    expiresAt: new Date(Date.now() + 30 * 86400000),
    isActive: true,
    usageLimit: 10000,
    usedCount: 0,
    perUserLimit: 1,
    firstOrderOnly: true,
  },
  {
    _id: "coup_flat500",
    code: "FLAT500",
    name: "Flat ₹500 Off",
    description: "Flat ₹500 discount on orders above ₹2,499",
    discountType: "FIXED",
    discountValue: 500,
    minimumOrderValue: 2499,
    maximumDiscountAmount: null,
    startAt: new Date(Date.now() - 86400000),
    expiresAt: new Date(Date.now() + 30 * 86400000),
    isActive: true,
    usageLimit: 5000,
    usedCount: 0,
    perUserLimit: 2,
    firstOrderOnly: false,
  },
  {
    _id: "coup_festive20",
    code: "FESTIVE20",
    name: "Festive Dhamaka 20% Off",
    description: "20% off up to ₹1,000 on orders above ₹999",
    discountType: "PERCENTAGE",
    discountValue: 20,
    minimumOrderValue: 999,
    maximumDiscountAmount: 1000,
    startAt: new Date(Date.now() - 86400000),
    expiresAt: new Date(Date.now() + 30 * 86400000),
    isActive: true,
    usageLimit: 2000,
    usedCount: 0,
    perUserLimit: 1,
    firstOrderOnly: false,
  },
  {
    _id: "coup_expired10",
    code: "EXPIRED10",
    name: "Expired Promo 10%",
    description: "Testing expired coupon code",
    discountType: "PERCENTAGE",
    discountValue: 10,
    minimumOrderValue: 200,
    maximumDiscountAmount: 100,
    startAt: new Date(Date.now() - 60 * 86400000),
    expiresAt: new Date(Date.now() - 30 * 86400000),
    isActive: true,
    usageLimit: 100,
    usedCount: 0,
    perUserLimit: 1,
    firstOrderOnly: false,
  },
  {
    _id: "coup_inactive50",
    code: "INACTIVE50",
    name: "Inactive Super 50%",
    description: "Testing inactive coupon code",
    discountType: "PERCENTAGE",
    discountValue: 50,
    minimumOrderValue: 100,
    maximumDiscountAmount: 500,
    startAt: new Date(Date.now() - 30 * 86400000),
    expiresAt: new Date(Date.now() + 30 * 86400000),
    isActive: false,
    usageLimit: 100,
    usedCount: 0,
    perUserLimit: 1,
    firstOrderOnly: false,
  },
];

/**
 * Standardizes coupon code normalization.
 */
export const normalizeCouponCode = (code) => {
  return String(code || "").trim().toUpperCase();
};

/**
 * Authoritative coupon validation and discount calculation engine.
 * Computes exact discounts based on eligible items, caps, and constraints.
 */
export const validateAndCalculateCoupon = async ({
  code,
  cartItems = [],
  userId,
  now = new Date(),
  couponDoc,
}) => {
  const normalized = normalizeCouponCode(code);
  if (!normalized) {
    throw new ApiError(400, "Coupon code is required", "COUPON_CODE_REQUIRED");
  }

  let coupon = couponDoc;
  if (!coupon && mongoose.connection.readyState === 1) {
    coupon = await Coupon.findOne({ code: normalized });
  }

  if (!coupon) {
    coupon = memoryCoupons.find((c) => c.code === normalized);
  }

  if (!coupon) {
    throw new ApiError(404, `Coupon "${normalized}" does not exist`, "COUPON_NOT_FOUND");
  }

  if (!coupon.isActive) {
    throw new ApiError(400, `Coupon "${normalized}" is no longer active`, "COUPON_INACTIVE");
  }

  if (coupon.startAt && now < new Date(coupon.startAt)) {
    throw new ApiError(400, `Coupon "${normalized}" is not active yet`, "COUPON_NOT_STARTED");
  }

  if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
    throw new ApiError(400, `Coupon "${normalized}" has expired`, "COUPON_EXPIRED");
  }

  // Global usage limit check
  if (
    coupon.usageLimit !== null &&
    coupon.usageLimit !== undefined &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    throw new ApiError(
      400,
      `Coupon "${normalized}" has reached its total usage limit`,
      "COUPON_USAGE_LIMIT_REACHED"
    );
  }

  // Per-user usage limit check
  if (userId && coupon.userUsage && Array.isArray(coupon.userUsage)) {
    const userStr = userId.toString();
    const userUsageEntry = coupon.userUsage.find(
      (u) => (u.user?._id?.toString() || u.user?.toString()) === userStr
    );
    const userUsedCount = userUsageEntry ? userUsageEntry.usedCount : 0;
    const perUserLimit = coupon.perUserLimit || 1;

    if (userUsedCount >= perUserLimit) {
      throw new ApiError(
        400,
        `You have already used coupon "${normalized}" the maximum allowed number of times`,
        "COUPON_USER_LIMIT_REACHED"
      );
    }
  }

  // First-order-only check
  if (coupon.firstOrderOnly && userId && mongoose.connection.readyState === 1) {
    const existingOrdersCount = await Order.countDocuments({
      customer: userId,
      status: { $nin: ["CANCELLED"] },
    });
    if (existingOrdersCount > 0) {
      throw new ApiError(
        400,
        `Coupon "${normalized}" is valid only on your first order`,
        "COUPON_FIRST_ORDER_ONLY"
      );
    }
  }

  // Evaluate eligible cart items
  const applicableProdIds = (coupon.applicableProducts || []).map((p) =>
    (p._id || p).toString()
  );
  const applicableCatIds = (coupon.applicableCategories || []).map((c) =>
    (c._id || c).toString()
  );
  const excludedProdIds = (coupon.excludedProducts || []).map((p) =>
    (p._id || p).toString()
  );
  const excludedCatIds = (coupon.excludedCategories || []).map((c) =>
    (c._id || c).toString()
  );

  let eligibleItems = [];
  let cartSubtotal = 0;

  for (const item of cartItems) {
    const pId = (item.productId || item.product?._id || item.product || item._id || "").toString();
    const cId = (item.categoryId || item.category?._id || item.category || "").toString();
    const lineTotal = Number(item.lineTotal || (item.price || item.unitPrice || 0) * (item.quantity || 1));

    cartSubtotal += lineTotal;

    // Check exclusion first
    if (excludedProdIds.includes(pId)) continue;
    if (cId && excludedCatIds.includes(cId)) continue;

    // Check inclusion
    let isEligible = true;
    if (applicableProdIds.length > 0 && !applicableProdIds.includes(pId)) {
      isEligible = false;
    }
    if (applicableCatIds.length > 0 && (!cId || !applicableCatIds.includes(cId))) {
      isEligible = false;
    }

    if (isEligible) {
      eligibleItems.push({
        ...item,
        lineTotal,
      });
    }
  }

  cartSubtotal = Math.round((cartSubtotal + Number.EPSILON) * 100) / 100;
  const eligibleAmount = Math.round(
    (eligibleItems.reduce((acc, it) => acc + it.lineTotal, 0) + Number.EPSILON) * 100
  ) / 100;

  if (eligibleItems.length === 0 || eligibleAmount <= 0) {
    throw new ApiError(
      400,
      `None of the items in your cart are eligible for coupon "${normalized}"`,
      "COUPON_NO_ELIGIBLE_ITEMS"
    );
  }

  // Minimum order value validation (evaluated against cart subtotal)
  const minOrder = Number(coupon.minimumOrderValue || 0);
  if (cartSubtotal < minOrder) {
    throw new ApiError(
      400,
      `Minimum order value of ₹${minOrder.toLocaleString("en-IN")} required to use coupon "${normalized}"`,
      "COUPON_MINIMUM_ORDER_NOT_MET"
    );
  }

  // Authoritative discount computation
  let calculatedDiscount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    const rawDiscount = (eligibleAmount * Number(coupon.discountValue)) / 100;
    calculatedDiscount = rawDiscount;
    if (
      coupon.maximumDiscountAmount !== null &&
      coupon.maximumDiscountAmount !== undefined &&
      Number(coupon.maximumDiscountAmount) > 0
    ) {
      calculatedDiscount = Math.min(calculatedDiscount, Number(coupon.maximumDiscountAmount));
    }
  } else if (coupon.discountType === "FIXED") {
    calculatedDiscount = Math.min(Number(coupon.discountValue), eligibleAmount);
  }

  // Money safety: round to 2 decimals and bound between 0 and eligibleAmount
  calculatedDiscount = Math.round((calculatedDiscount + Number.EPSILON) * 100) / 100;
  calculatedDiscount = Math.max(0, Math.min(calculatedDiscount, eligibleAmount));

  return {
    valid: true,
    couponId: coupon._id ? coupon._id.toString() : undefined,
    code: coupon.code,
    name: coupon.name,
    description: coupon.description || "",
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    discountAmount: calculatedDiscount,
    eligibleAmount,
    minimumOrderValue: minOrder,
    maximumDiscountAmount: coupon.maximumDiscountAmount ? Number(coupon.maximumDiscountAmount) : null,
    expiresAt: coupon.expiresAt,
    currency: "INR",
    currencySymbol: "₹",
  };
};

/**
 * Consumes a coupon's usage atomically upon successful order creation.
 */
export const consumeCouponUsage = async (couponIdOrCode, userId) => {
  if (!couponIdOrCode || mongoose.connection.readyState !== 1) return;

  const query = mongoose.isValidObjectId(couponIdOrCode)
    ? { _id: couponIdOrCode }
    : { code: normalizeCouponCode(couponIdOrCode) };

  const coupon = await Coupon.findOne(query);
  if (!coupon) return;

  const userStr = userId ? userId.toString() : null;

  if (userStr) {
    const userUsageEntry = coupon.userUsage?.find(
      (u) => (u.user?._id?.toString() || u.user?.toString()) === userStr
    );

    if (userUsageEntry) {
      await Coupon.updateOne(
        { _id: coupon._id, "userUsage.user": userId },
        {
          $inc: { usedCount: 1, "userUsage.$.usedCount": 1 },
          $set: { "userUsage.$.lastUsedAt": new Date() },
        }
      );
      return;
    } else {
      await Coupon.updateOne(
        { _id: coupon._id },
        {
          $inc: { usedCount: 1 },
          $push: {
            userUsage: {
              user: userId,
              usedCount: 1,
              lastUsedAt: new Date(),
            },
          },
        }
      );
      return;
    }
  }

  await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
};
