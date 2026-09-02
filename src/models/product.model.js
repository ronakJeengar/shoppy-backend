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
    stock: {
      type: Number,
      default: 0,
    },
    productRating: {
      type: Number,
      default: 0,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
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
