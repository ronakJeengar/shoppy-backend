import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Wishlist } from "../../models/wishlist.model.js";
import { memoryWishlists } from "../../controllers/wishlist.controller.js";
import { AiError } from "../errors/aiError.js";

export class RemoveFromWishlistTool extends AITool {
  constructor() {
    super({
      name: "remove_from_wishlist",
      description: "Remove a product from the authenticated customer's wishlist bookmarks.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The unique product ID to remove from the wishlist",
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
      let wishlist = await Wishlist.findOne({ user: userId });
      if (!wishlist || !wishlist.products) {
        return {
          success: true,
          productId,
          inWishlist: false,
          totalItems: 0,
          message: "Wishlist is already empty",
        };
      }

      const initialLength = wishlist.products.length;
      wishlist.products = wishlist.products.filter(
        (pId) => pId.toString() !== productId.toString()
      );

      if (wishlist.products.length !== initialLength) {
        await wishlist.save();
      }

      return {
        success: true,
        productId,
        inWishlist: false,
        totalItems: wishlist.products.length,
        message: "Removed product from wishlist",
      };
    }

    // In-memory fallback
    const uKey = userId.toString();
    let items = memoryWishlists.get(uKey) || [];
    const filtered = items.filter(
      (p) => (p._id && p._id.toString() !== productId.toString()) && p.id !== productId
    );
    memoryWishlists.set(uKey, filtered);

    return {
      success: true,
      productId,
      inWishlist: false,
      totalItems: filtered.length,
      message: "Removed product from wishlist",
    };
  }
}
