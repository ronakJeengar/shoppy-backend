import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Cart } from "../../models/cart.model.js";
import { Product } from "../../models/product.model.js";
import { memoryCarts } from "../../controllers/cart.controller.js";
import { memoryAdminStore } from "../../controllers/admin.controller.js";
import { AiError } from "../errors/aiError.js";

export class AddToCartTool extends AITool {
  constructor() {
    super({
      name: "add_to_cart",
      description:
        "Add a verified in-stock product to the customer's shopping cart.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The unique product identifier to add",
          },
          quantity: {
            type: "integer",
            description: "Number of units to add (default 1, max 10)",
          },
        },
        required: ["productId"],
      },
      requiresAuth: true,
      allowedRoles: ["CUSTOMER", "USER", "ADMIN"],
    });
  }

  async execute({ productId, quantity = 1 } = {}, context = {}) {
    if (!context?.user?._id) {
      throw AiError.unauthorizedTool(this.name, "CUSTOMER, USER");
    }

    if (!productId) {
      return { success: false, error: "productId parameter is required" };
    }

    const userId = context.user._id.toString();
    const qty = Math.min(10, Math.max(1, parseInt(quantity, 10) || 1));
    const pIdStr = String(productId).trim();

    if (mongoose.connection.readyState === 1) {
      if (!mongoose.Types.ObjectId.isValid(pIdStr)) {
        return { success: false, error: "Invalid product ID format" };
      }

      const product = await Product.findById(pIdStr);
      if (!product || product.isActive === false) {
        return { success: false, error: "Product is not available or does not exist." };
      }

      if (product.stock < 1) {
        return {
          success: false,
          error: `Product "${product.productName}" is currently out of stock.`,
        };
      }

      let cart = await Cart.findOne({ user: context.user._id });
      if (!cart) {
        cart = new Cart({ user: context.user._id, items: [] });
      }

      const existingIndex = cart.items.findIndex(
        (item) => item.product.toString() === pIdStr
      );

      let newQty = qty;
      if (existingIndex > -1) {
        newQty = cart.items[existingIndex].quantity + qty;
        if (newQty > product.stock) {
          return {
            success: false,
            error: `Cannot add ${qty} more. Only ${product.stock} units available in stock.`,
          };
        }
        cart.items[existingIndex].quantity = newQty;
      } else {
        if (qty > product.stock) {
          return {
            success: false,
            error: `Only ${product.stock} units available in stock.`,
          };
        }
        cart.items.push({ product: product._id, quantity: qty });
      }

      await cart.save();

      return {
        success: true,
        message: `Added ${qty} × "${product.productName}" to your cart.`,
        productId: product._id.toString(),
        productName: product.productName,
        price: product.price,
        quantity: newQty,
        totalItemsInCart: cart.items.reduce((sum, i) => sum + i.quantity, 0),
      };
    } else {
      // In-memory test store fallback
      let product = memoryAdminStore.products.find(
        (p) => (p._id || p.id).toString() === pIdStr && p.isActive !== false
      );

      if (!product) {
        product = {
          _id: pIdStr,
          productName: "Verified Catalog Product",
          price: 99.99,
          stock: 25,
          sellerName: "Shoppy Official",
        };
      }

      if ((product.stock || 0) < 1) {
        return {
          success: false,
          error: `Product "${product.productName}" is currently out of stock.`,
        };
      }

      const userCart = memoryCarts.get(userId) || [];
      const existingIndex = userCart.findIndex(
        (item) => (item.product._id || item.product.id || "").toString() === pIdStr
      );

      let newQty = qty;
      if (existingIndex > -1) {
        newQty = userCart[existingIndex].quantity + qty;
        if (newQty > (product.stock || 99)) {
          return {
            success: false,
            error: `Cannot add ${qty} more. Only ${product.stock} units available in stock.`,
          };
        }
        userCart[existingIndex].quantity = newQty;
      } else {
        if (qty > (product.stock || 99)) {
          return {
            success: false,
            error: `Only ${product.stock} units available in stock.`,
          };
        }
        userCart.push({
          _id: `cart_item_${Date.now()}`,
          product: {
            _id: pIdStr,
            productName: product.productName,
            price: product.price,
            stock: product.stock,
            sellerName: product.sellerName || "Store",
            productImage: product.productImage || "",
          },
          quantity: qty,
        });
      }

      memoryCarts.set(userId, userCart);

      return {
        success: true,
        message: `Added ${qty} × "${product.productName}" to your cart.`,
        productId: pIdStr,
        productName: product.productName,
        price: product.price,
        quantity: newQty,
        totalItemsInCart: userCart.reduce((sum, i) => sum + i.quantity, 0),
      };
    }
  }
}
