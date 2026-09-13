import mongoose, { Schema } from "mongoose";

export const ALLOWED_SALE_TYPES = [
  "FLASH_SALE",
  "QUICK_SALE",
  "LIMITED_TIME",
  "LIGHTNING_DEAL",
];

export const ALLOWED_DISCOUNT_TYPES = [
  "PERCENTAGE",
  "FIXED_PRICE",
  "FIXED_AMOUNT",
];

const flashSaleItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    discountType: {
      type: String,
      enum: ALLOWED_DISCOUNT_TYPES,
      default: "PERCENTAGE",
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    salePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    regularPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumQuantityPerOrder: {
      type: Number,
      default: 2,
      min: 1,
    },
    stockAllocated: {
      type: Number,
      default: 0,
      min: 0,
    },
    stockSold: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: true }
);

const flashSaleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    saleType: {
      type: String,
      enum: ALLOWED_SALE_TYPES,
      default: "FLASH_SALE",
    },
    bannerImage: {
      type: String,
      default: "",
      trim: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    endAt: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    items: {
      type: [flashSaleItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

flashSaleSchema.index({ isActive: 1, startAt: 1, endAt: 1, priority: -1 });
flashSaleSchema.index({ "items.product": 1 });

export const FlashSale = mongoose.model("FlashSale", flashSaleSchema);
