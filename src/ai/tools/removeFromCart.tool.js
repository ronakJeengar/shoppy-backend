import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Cart } from "../../models/cart.model.js";
import { memoryCarts } from "../../controllers/cart.controller.js";
import { AiError } from "../errors/aiError.js";

export class RemoveFromCartTool extends AITool {
  constructor() {
    super({
      name: "remove_from_cart",
      description: "Remove a specified product from the customer's active shopping cart.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The product ID to remove from the cart",
          },
        },
        required: ["productId"],
      },
      requiresAuth: true,
      allowedRoles: ["CUSTOMER", "USER", "ADMIN"],
      sideEffectType: "WRITE",
    });
  }

  async execute({ productId } = {}, context = {}) {
    if (!context?.user?._id) {
      throw AiError.unauthorizedTool(this.name, "CUSTOMER, USER");
    }

    if (!productId) {
      return { success: false, error: "productId parameter is required" };
    }

    const userId = context.user._id.toString();
    const pIdStr = String(productId).trim();

    if (mongoose.connection.readyState === 1) {
      const cart = await Cart.findOne({ user: context.user._id });
      if (!cart) {
        return { success: true, message: "Cart is already empty.", remainingItemsCount: 0 };
      }

      const initialCount = cart.items.length;
      cart.items = cart.items.filter(
        (item) => item.product.toString() !== pIdStr
      );

      if (cart.items.length === initialCount) {
        return {
          success: false,
          message: "Product was not found in your cart.",
          remainingItemsCount: cart.items.length,
        };
      }

      await cart.save();
      return {
        success: true,
        message: "Item removed from your cart.",
        remainingItemsCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
      };
    } else {
      let userCart = memoryCarts.get(userId) || [];
      const initialCount = userCart.length;
      userCart = userCart.filter(
        (item) => (item.product._id || item.product.id || "").toString() !== pIdStr
      );

      if (userCart.length === initialCount) {
        return {
          success: false,
          message: "Product was not found in your cart.",
          remainingItemsCount: userCart.length,
        };
      }

      memoryCarts.set(userId, userCart);
      return {
        success: true,
        message: "Item removed from your cart.",
        remainingItemsCount: userCart.reduce((sum, i) => sum + i.quantity, 0),
      };
    }
  }
}
