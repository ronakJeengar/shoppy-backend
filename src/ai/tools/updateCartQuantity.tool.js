import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Cart } from "../../models/cart.model.js";
import { Product } from "../../models/product.model.js";
import { memoryCarts } from "../../controllers/cart.controller.js";
import { AiError } from "../errors/aiError.js";

export class UpdateCartQuantityTool extends AITool {
  constructor() {
    super({
      name: "update_cart_quantity",
      description:
        "Update the quantity of a product currently in the authenticated user's shopping cart. Setting quantity to 0 removes the item.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The unique product ID to update in the cart",
          },
          quantity: {
            type: "integer",
            minimum: 0,
            maximum: 50,
            description: "The new target quantity for this item (0 to 50)",
          },
        },
        required: ["productId", "quantity"],
      },
      requiresAuth: true,
      allowedRoles: ["CUSTOMER", "USER", "ADMIN"],
      sideEffectType: "WRITE",
      timeout: 4000,
      idempotent: true,
    });
  }

  async execute({ productId, quantity }, context) {
    if (!context.user?._id) {
      throw AiError.unauthorizedTool(this.name, "CUSTOMER");
    }

    const userId = context.user._id;
    const targetQty = parseInt(quantity, 10);

    if (mongoose.connection.readyState === 1) {
      const cart = await Cart.findOne({ user: userId });
      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error("Cart is empty or not found");
      }

      const itemIndex = cart.items.findIndex(
        (i) => i.product.toString() === productId.toString() || i._id.toString() === productId.toString()
      );

      if (itemIndex === -1) {
        throw new Error(`Product ${productId} is not currently in the shopping cart`);
      }

      if (targetQty === 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        const prod = await Product.findById(cart.items[itemIndex].product);
        if (!prod || prod.stock < targetQty) {
          throw new Error(
            `Cannot update quantity to ${targetQty}. Only ${prod?.stock ?? 0} available in stock.`
          );
        }
        cart.items[itemIndex].quantity = targetQty;
      }

      await cart.save();
      const populated = await Cart.findById(cart._id).populate("items.product");

      let subtotal = 0;
      let count = 0;
      for (const it of populated.items) {
        if (it.product) {
          subtotal += (it.product.price || 0) * it.quantity;
          count += it.quantity;
        }
      }

      return {
        success: true,
        cartId: cart._id.toString(),
        totalItems: count,
        subtotal: Math.round(subtotal * 100) / 100,
        itemsCount: populated.items.length,
        message: targetQty === 0 ? "Item removed from cart" : `Quantity updated to ${targetQty}`,
      };
    }

    // In-memory fallback
    const uKey = userId.toString();
    const userCart = memoryCarts.get(uKey) || [];

    const existingIndex = userCart.findIndex(
      (item) =>
        item.product?._id?.toString() === productId.toString() ||
        item.product?.id?.toString() === productId.toString() ||
        item._id?.toString() === productId.toString()
    );

    if (existingIndex === -1) {
      throw new Error(`Product ${productId} is not currently in the shopping cart`);
    }

    if (targetQty === 0) {
      userCart.splice(existingIndex, 1);
    } else {
      const currentItem = userCart[existingIndex];
      const stockAvailable = currentItem.product?.stock ?? 30;
      if (targetQty > stockAvailable) {
        throw new Error(
          `Cannot update quantity to ${targetQty}. Only ${stockAvailable} available in stock.`
        );
      }
      userCart[existingIndex].quantity = targetQty;
    }

    memoryCarts.set(uKey, userCart);

    let subtotal = 0;
    let count = 0;
    for (const it of userCart) {
      subtotal += (it.product?.price || 0) * it.quantity;
      count += it.quantity;
    }

    return {
      success: true,
      cartId: `cart_${uKey}`,
      totalItems: count,
      subtotal: Math.round(subtotal * 100) / 100,
      itemsCount: userCart.length,
      message: targetQty === 0 ? "Item removed from cart" : `Quantity updated to ${targetQty}`,
    };
  }
}
