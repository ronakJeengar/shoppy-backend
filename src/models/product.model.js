import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const productSchema = new Schema(
  {
    productImage: {
      type: String, //cloudnary
      required: true,
    },
    prodcutName: {
      type: String,
      required: true,
      trim: true,
    },
    sellername: {
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
      trim: true,
    },
    stock: {
      type: Number,
      default: 0,
    },
    productRating: {
      type: Number,
      required: true,
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

export const User = mongoose.Schema("Product", productSchema);
