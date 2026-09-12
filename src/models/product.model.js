import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const productSchema = new Schema(
  {
    productImage: {
      type: String, //cloudnary
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sellerName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
      required: true,
    },
    mrp: {
      type: Number,
      default: function () {
        return this.price || 0;
      },
    },
    hsnCode: {
      type: String,
      default: "8518",
      trim: true,
    },
    gstRate: {
      type: Number,
      enum: [0, 5, 12, 18, 28],
      default: 18,
      required: true,
    },
    isTaxInclusive: {
      type: Boolean,
      default: true,
    },
    isCodEligible: {
      type: Boolean,
      default: true,
    },
    stock: {
      type: Number,
      default: 0,
    },
    productRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    images: {
      type: [String],
      default: [],
    },
    videoUrl: {
      type: String,
      default: null,
    },
    model3dUrl: {
      type: String,
      default: null,
    },
    media: [
      {
        type: {
          type: String,
          enum: ["IMAGE", "VIDEO", "MODEL_3D"],
          default: "IMAGE",
        },
        url: {
          type: String,
          required: true,
        },
        thumbnailUrl: {
          type: String,
        },
        sortOrder: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

productSchema.plugin(mongooseAggregatePaginate);

productSchema.index({ category: 1, price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ productName: "text", description: "text" });

export const Product = mongoose.model("Product", productSchema);
