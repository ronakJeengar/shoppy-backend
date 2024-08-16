import mongoose, { Schema } from "mongoose";

const categrorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Category = mongoose.Schema("Category", categrorySchema);
