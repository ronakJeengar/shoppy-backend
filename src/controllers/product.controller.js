import mongoose from "mongoose";
import { Product } from "../models/product.model.js";
import { Category } from "../models/category.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const fallbackProducts = [
  {
    _id: "64f2b1a2b3c4d5e6f7a8b001",
    productName: "Wireless Noise-Cancelling Headphones",
    sellerName: "SoundTech Official",
    description:
      "High-fidelity wireless headphones with dynamic 40mm drivers, active noise cancellation, 30-hour battery life, and comfortable memory foam earcups.",
    price: 149.99,
    stock: 45,
    productRating: 4.8,
    productImage:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b002",
    productName: "Smart Fitness Watch Ultra",
    sellerName: "PulseTech Wearables",
    description:
      "Advanced health monitoring smartwatch featuring heart rate tracking, blood oxygen sensor, GPS route tracking, and water resistance up to 50m.",
    price: 199.99,
    stock: 28,
    productRating: 4.6,
    productImage:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    createdAt: new Date("2026-01-02T00:00:00Z"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b003",
    productName: "Classic Organic Cotton Crewneck",
    sellerName: "Urban Threads Co.",
    description:
      "Tailored 100% certified organic cotton tee with reinforced stitching, pre-shrunk fabric, and a soft-brushed premium finish.",
    price: 29.99,
    stock: 120,
    productRating: 4.7,
    productImage:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c002", name: "fashion" },
    createdAt: new Date("2026-01-03T00:00:00Z"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b004",
    productName: "Minimalist Leather Cardholder Wallet",
    sellerName: "Craft & Hide",
    description:
      "Handcrafted full-grain leather wallet with RFID blocking technology, 6 card slots, and an ultra-slim modern profile.",
    price: 39.5,
    stock: 65,
    productRating: 4.9,
    productImage:
      "https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c002", name: "fashion" },
    createdAt: new Date("2026-01-04T00:00:00Z"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b005",
    productName: "Precision Pour-Over Coffee Dripper",
    sellerName: "Artisan Brewware",
    description:
      "Ceramic pour-over cone designed with spiral ribs for optimal extraction flow rate. Includes reusable stainless steel mesh filter.",
    price: 34.0,
    stock: 50,
    productRating: 4.5,
    productImage:
      "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c003", name: "home & kitchen" },
    createdAt: new Date("2026-01-05T00:00:00Z"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b006",
    productName: "Pro Insulated Stainless Water Bottle 1L",
    sellerName: "Summit Outdoors",
    description:
      "Double-walled vacuum insulated thermal flask keeping liquids icy cold for 24 hours or steaming hot for 12 hours. BPA-free leakproof lid.",
    price: 24.99,
    stock: 80,
    productRating: 4.9,
    productImage:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c004", name: "sports & outdoors" },
    createdAt: new Date("2026-01-06T00:00:00Z"),
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b007",
    productName: "Hardcover Dotted Grid Journal",
    sellerName: "PaperCraft Studio",
    description:
      "Premium 120gsm fountain-pen friendly archival paper, expanding back pocket, dual ribbon bookmarks, and durable vegan leather cover.",
    price: 18.5,
    stock: 90,
    productRating: 4.8,
    productImage:
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80",
    category: { _id: "64f1a2b3c4d5e6f7a8b9c005", name: "books & stationery" },
    createdAt: new Date("2026-01-07T00:00:00Z"),
  },
];

export const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    search,
    minPrice,
    maxPrice,
    sort = "newest",
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  let total = 0;
  let rawProducts = [];

  if (mongoose.connection.readyState === 1) {
    const filter = {};

    if (category && category.trim()) {
      if (mongoose.Types.ObjectId.isValid(category.trim())) {
        filter.category = category.trim();
      }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { productName: searchRegex },
        { description: searchRegex },
        { sellerName: searchRegex },
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined && !isNaN(parseFloat(minPrice))) {
        filter.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(parseFloat(maxPrice))) {
        filter.price.$lte = parseFloat(maxPrice);
      }
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") {
      sortOption = { price: 1 };
    } else if (sort === "price_desc") {
      sortOption = { price: -1 };
    } else if (sort === "rating") {
      sortOption = { productRating: -1 };
    }

    [total, rawProducts] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("category", "name")
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);
  } else {
    // Offline/testing fallback dataset
    let filtered = [...fallbackProducts];

    if (category && category.trim()) {
      filtered = filtered.filter(
        (p) =>
          p.category?._id?.toString() === category.trim() ||
          p.category?.name?.toLowerCase() === category.trim().toLowerCase()
      );
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.productName.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term) ||
          p.sellerName.toLowerCase().includes(term)
      );
    }

    if (minPrice !== undefined && !isNaN(parseFloat(minPrice))) {
      filtered = filtered.filter((p) => p.price >= parseFloat(minPrice));
    }
    if (maxPrice !== undefined && !isNaN(parseFloat(maxPrice))) {
      filtered = filtered.filter((p) => p.price <= parseFloat(maxPrice));
    }

    if (sort === "price_asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sort === "price_desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sort === "rating") {
      filtered.sort((a, b) => b.productRating - a.productRating);
    } else {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    total = filtered.length;
    rawProducts = filtered.slice(skip, skip + limitNum);
  }

  const products = rawProducts.map((p) => ({
    id: p._id,
    _id: p._id,
    productName: p.productName,
    name: p.productName,
    sellerName: p.sellerName,
    description: p.description || "",
    price: p.price,
    stock: p.stock,
    productRating: p.productRating || 0,
    productImage: p.productImage,
    imageUrl: p.productImage,
    category: p.category
      ? {
          id: p.category._id,
          _id: p.category._id,
          name: p.category.name,
        }
      : null,
    createdAt: p.createdAt,
  }));

  const totalPages = Math.ceil(total / limitNum) || 1;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      },
      "Products retrieved successfully"
    )
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product ID format");
  }

  let product = null;

  if (mongoose.connection.readyState === 1) {
    product = await Product.findById(id)
      .populate("category", "name")
      .lean();
  } else {
    product = fallbackProducts.find((p) => p._id.toString() === id.toString()) || null;
  }

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const formattedProduct = {
    id: product._id,
    _id: product._id,
    productName: product.productName,
    name: product.productName,
    sellerName: product.sellerName,
    description: product.description || "",
    price: product.price,
    stock: product.stock,
    productRating: product.productRating || 0,
    productImage: product.productImage,
    imageUrl: product.productImage,
    category: product.category
      ? {
          id: product.category._id,
          _id: product.category._id,
          name: product.category.name,
        }
      : null,
    createdAt: product.createdAt,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, formattedProduct, "Product retrieved successfully")
    );
});

export const createProduct = asyncHandler(async (req, res) => {
  const {
    productName,
    sellerName,
    description,
    price,
    stock,
    productImage,
    category,
  } = req.body;

  if (!productName || !productName.trim()) {
    throw new ApiError(400, "Product name is required");
  }
  if (!sellerName || !sellerName.trim()) {
    throw new ApiError(400, "Seller name is required");
  }
  if (price === undefined || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
    throw new ApiError(400, "Valid price is required");
  }
  if (!productImage || !productImage.trim()) {
    throw new ApiError(400, "Product image URL is required");
  }
  if (!category || !mongoose.Types.ObjectId.isValid(category)) {
    throw new ApiError(400, "Valid category ID is required");
  }

  if (mongoose.connection.readyState === 1) {
    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      throw new ApiError(404, "Selected category does not exist");
    }

    const product = await Product.create({
      productName: productName.trim(),
      sellerName: sellerName.trim(),
      description: description ? description.trim() : "",
      price: parseFloat(price),
      stock: stock !== undefined ? Math.max(0, parseInt(stock, 10)) : 0,
      productImage: productImage.trim(),
      category,
      productRating: 0,
    });

    const populated = await Product.findById(product._id)
      .populate("category", "name")
      .lean();

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          id: populated._id,
          _id: populated._id,
          productName: populated.productName,
          name: populated.productName,
          sellerName: populated.sellerName,
          description: populated.description,
          price: populated.price,
          stock: populated.stock,
          productRating: populated.productRating,
          productImage: populated.productImage,
          imageUrl: populated.productImage,
          category: {
            id: populated.category._id,
            name: populated.category.name,
          },
        },
        "Product created successfully"
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
          productName: productName.trim(),
          name: productName.trim(),
          sellerName: sellerName.trim(),
          description: description || "",
          price: parseFloat(price),
          stock: stock !== undefined ? parseInt(stock, 10) : 0,
          productRating: 0,
          productImage: productImage.trim(),
          imageUrl: productImage.trim(),
          category: {
            id: category,
            name: "Category",
          },
        },
        "Product created successfully"
      )
    );
  }
});
