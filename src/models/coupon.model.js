import mongoose, { Schema } from "mongoose";

const couponUserUsageSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    usedCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Coupon name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    discountType: {
      type: String,
      required: [true, "Discount type is required"],
      enum: ["PERCENTAGE", "FIXED"],
      default: "PERCENTAGE",
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    minimumOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Minimum order value cannot be negative"],
    },
    maximumDiscountAmount: {
      type: Number,
      default: null,
      min: [0, "Maximum discount amount cannot be negative"],
    },
    startAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    usageLimit: {
      type: Number,
      default: null, // null means unlimited
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },
    applicableProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    excludedProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    excludedCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    firstOrderOnly: {
      type: Boolean,
      default: false,
    },
    newUserOnly: {
      type: Boolean,
      default: false,
    },
    stackable: {
      type: Boolean,
      default: false,
    },
    userUsage: [couponUserUsageSchema],
  },
  {
    timestamps: true,
  }
);

couponSchema.index({ isActive: 1, startAt: 1, expiresAt: 1 });

export const Coupon = mongoose.model("Coupon", couponSchema);
