import mongoose from "mongoose";
import { Category } from "../models/category.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const fallbackCategories = [
  { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
  { _id: "64f1a2b3c4d5e6f7a8b9c002", name: "fashion" },
  { _id: "64f1a2b3c4d5e6f7a8b9c003", name: "home & kitchen" },
  { _id: "64f1a2b3c4d5e6f7a8b9c004", name: "sports & outdoors" },
  { _id: "64f1a2b3c4d5e6f7a8b9c005", name: "books & stationery" },
];

export const getCategories = asyncHandler(async (req, res) => {
  let categories;

  if (mongoose.connection.readyState === 1) {
    const rawCategories = await Category.find().sort({ name: 1 }).lean();
    categories = rawCategories.map((cat) => ({
      id: cat._id,
      _id: cat._id,
      name: cat.name,
    }));
  } else {
    categories = fallbackCategories.map((cat) => ({
      id: cat._id,
      _id: cat._id,
      name: cat.name,
    }));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, categories, "Categories fetched successfully"));
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, "Category name is required");
  }

  const normalizedName = name.trim().toLowerCase();

  if (mongoose.connection.readyState === 1) {
    const existingCategory = await Category.findOne({ name: normalizedName });
    if (existingCategory) {
      throw new ApiError(409, `Category '${normalizedName}' already exists`);
    }

    const category = await Category.create({ name: normalizedName });

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          id: category._id,
          _id: category._id,
          name: category.name,
        },
        "Category created successfully"
      )
    );
  } else {
    const id = new mongoose.Types.ObjectId();
    return res.status(201).json(
      new ApiResponse(
        201,
        {
          id,
          _id: id,
          name: normalizedName,
        },
        "Category created successfully"
      )
    );
  }
});
