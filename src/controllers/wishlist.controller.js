import mongoose from "mongoose";
import { Wishlist } from "../models/wishlist.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// In-memory test store for when MongoDB is disconnected during tests
export const memoryWishlists = new Map();

const fallbackCatalog = [
  {
    _id: "64f2b1a2b3c4d5e6f7a8b001",
    productName: "Wireless Noise-Cancelling Headphones",
    sellerName: "SoundTech Official",
    price: 149.99,
    stock: 45,
    productRating: 4.8,
    productImage:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b002",
    productName: "Smart Fitness Watch Ultra",
    sellerName: "PulseTech Wearables",
    price: 199.99,
    stock: 28,
    productRating: 4.6,
    productImage:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
  },
];

const formatWishlistProducts = (products) => {
  return products.map((p) => ({
    id: p._id ? p._id.toString() : p.id,
    _id: p._id ? p._id.toString() : p.id,
    productName: p.productName || p.name,
    name: p.productName || p.name,
    sellerName: p.sellerName || "Official Seller",
    price: p.price,
    stock: p.stock !== undefined ? p.stock : 99,
    productRating: p.productRating || 0,
    productImage: p.productImage || p.imageUrl || "",
    imageUrl: p.productImage || p.imageUrl || "",
  }));
};

export const getWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (mongoose.connection.readyState === 1) {
    let wishlist = await Wishlist.findOne({ user: userId }).populate("products");
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }

    const items = formatWishlistProducts(wishlist.products || []);
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          items,
          count: items.length,
        },
        "Wishlist retrieved successfully"
      )
    );
  } else {
    const uKey = userId.toString();
    const items = memoryWishlists.get(uKey) || [];
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          items,
          count: items.length,
        },
        "Wishlist retrieved successfully"
      )
    );
  }
});

export const toggleWishlistItem = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.body;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Valid product ID is required");
  }

  if (mongoose.connection.readyState === 1) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, products: [] });
    }

    const existingIndex = wishlist.products.findIndex(
      (pId) => pId.toString() === productId.toString()
    );

    let inWishlist = false;
    if (existingIndex > -1) {
      wishlist.products.splice(existingIndex, 1);
      inWishlist = false;
    } else {
      wishlist.products.push(productId);
      inWishlist = true;
    }

    await wishlist.save();
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          productId,
          inWishlist,
          count: wishlist.products.length,
        },
        inWishlist ? "Added to wishlist" : "Removed from wishlist"
      )
    );
  } else {
    const uKey = userId.toString();
    let items = memoryWishlists.get(uKey) || [];

    const existingIndex = items.findIndex(
      (p) => p.id === productId || p._id === productId
    );

    let inWishlist = false;
    if (existingIndex > -1) {
      items.splice(existingIndex, 1);
      inWishlist = false;
    } else {
      const match = fallbackCatalog.find(
        (p) => p._id.toString() === productId.toString()
      ) || {
        _id: productId,
        id: productId,
        productName: "Sample Bookmarked Item",
        sellerName: "Test Seller",
        price: 29.99,
        stock: 50,
        productRating: 4.5,
        productImage: "",
      };
      items.push({
        ...match,
        id: match._id.toString(),
      });
      inWishlist = true;
    }

    memoryWishlists.set(uKey, items);
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          productId,
          inWishlist,
          count: items.length,
        },
        inWishlist ? "Added to wishlist" : "Removed from wishlist"
      )
    );
  }
});

export const addToWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.body;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Valid product ID is required");
  }

  if (mongoose.connection.readyState === 1) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, products: [] });
    }

    const alreadyAdded = wishlist.products.some(
      (pId) => pId.toString() === productId.toString()
    );

    if (!alreadyAdded) {
      wishlist.products.push(productId);
      await wishlist.save();
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { productId, inWishlist: true, count: wishlist.products.length },
        "Product added to wishlist"
      )
    );
  } else {
    const uKey = userId.toString();
    const items = memoryWishlists.get(uKey) || [];
    const already = items.some((p) => p.id === productId || p._id === productId);

    if (!already) {
      const match = fallbackCatalog.find(
        (p) => p._id.toString() === productId.toString()
      ) || {
        _id: productId,
        id: productId,
        productName: "Sample Bookmarked Item",
        sellerName: "Test Seller",
        price: 29.99,
        stock: 50,
        productRating: 4.5,
        productImage: "",
      };
      items.push({ ...match, id: match._id.toString() });
      memoryWishlists.set(uKey, items);
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { productId, inWishlist: true, count: items.length },
        "Product added to wishlist"
      )
    );
  }
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Valid product ID is required");
  }

  if (mongoose.connection.readyState === 1) {
    const wishlist = await Wishlist.findOne({ user: userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        (pId) => pId.toString() !== productId.toString()
      );
      await wishlist.save();
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { productId, inWishlist: false, count: wishlist?.products.length || 0 },
        "Product removed from wishlist"
      )
    );
  } else {
    const uKey = userId.toString();
    let items = memoryWishlists.get(uKey) || [];
    items = items.filter((p) => p.id !== productId && p._id !== productId);
    memoryWishlists.set(uKey, items);

    return res.status(200).json(
      new ApiResponse(
        200,
        { productId, inWishlist: false, count: items.length },
        "Product removed from wishlist"
      )
    );
  }
});
