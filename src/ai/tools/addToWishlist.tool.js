import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Wishlist } from "../../models/wishlist.model.js";
import { Product } from "../../models/product.model.js";
import { memoryWishlists } from "../../controllers/wishlist.controller.js";
import { AiError } from "../errors/aiError.js";

export class AddToWishlistTool extends AITool {
  constructor() {
    super({
      name: "add_to_wishlist",
      description: "Add a product to the authenticated customer's wishlist bookmarks.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The unique product ID to add to the wishlist",
          },
        },
        required: ["productId"],
      },
      requiresAuth: true,
      allowedRoles: ["CUSTOMER", "USER", "ADMIN"],
      sideEffectType: "WRITE",
      timeout: 3000,
      idempotent: true,
    });
  }

  async execute({ productId }, context) {
    if (!context.user?._id) {
      throw AiError.unauthorizedTool(this.name, "CUSTOMER");
    }

    const userId = context.user._id;

    if (mongoose.connection.readyState === 1) {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error(`Product '${productId}' was not found in the catalog`);
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

      return {
        success: true,
        productId,
        productName: product.productName,
        price: product.price,
        inWishlist: true,
        totalItems: wishlist.products.length,
        message: alreadyAdded
          ? "Product is already in your wishlist"
          : `Added '${product.productName}' to your wishlist`,
      };
    }

    // In-memory fallback
    const uKey = userId.toString();
    const items = memoryWishlists.get(uKey) || [];

    const existingIndex = items.findIndex(
      (p) => (p._id && p._id.toString() === productId.toString()) || p.id === productId
    );

    if (existingIndex === -1) {
      items.push({
        _id: productId,
        id: productId,
        productName: "Wishlist Bookmarked Item",
        price: 49.99,
        stock: 25,
      });
      memoryWishlists.set(uKey, items);
    }

    return {
      success: true,
      productId,
      productName: items[existingIndex > -1 ? existingIndex : items.length - 1].productName,
      inWishlist: true,
      totalItems: items.length,
      message: existingIndex > -1
        ? "Product is already in your wishlist"
        : "Added product to your wishlist",
    };
  }
}
