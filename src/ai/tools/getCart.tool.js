import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Cart } from "../../models/cart.model.js";
import { memoryCarts } from "../../controllers/cart.controller.js";
import { AiError } from "../errors/aiError.js";

export class GetCartTool extends AITool {
  constructor() {
    super({
      name: "get_cart",
      description:
        "Retrieve current items, item count, and price summary of the customer's active shopping cart.",
      parameters: {
        type: "object",
        properties: {},
      },
      requiresAuth: true,
      allowedRoles: ["CUSTOMER", "USER", "ADMIN"],
    });
  }

  async execute(args, context = {}) {
    if (!context?.user?._id) {
      throw AiError.unauthorizedTool(this.name, "CUSTOMER, USER");
    }

    const userId = context.user._id.toString();

    if (mongoose.connection.readyState === 1) {
      const cart = await Cart.findOne({ user: context.user._id }).populate("items.product");
      if (!cart || !cart.items || cart.items.length === 0) {
        return {
          itemCount: 0,
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0,
          items: [],
          message: "Your shopping cart is currently empty.",
        };
      }

      let subtotal = 0;
      let itemCount = 0;
      const items = cart.items
        .filter((item) => item.product)
        .map((item) => {
          const p = item.product;
          const qty = item.quantity;
          const unitPrice = typeof p.price === "number" ? p.price : 0;
          const lineTotal = Math.round(unitPrice * qty * 100) / 100;
          subtotal += lineTotal;
          itemCount += qty;

          return {
            id: item._id ? item._id.toString() : p._id.toString(),
            productId: p._id.toString(),
            name: p.productName || "Product",
            price: unitPrice,
            quantity: qty,
            lineTotal,
            inStock: (p.stock || 0) >= qty,
            seller: p.sellerName || "Store",
            productImage: p.productImage || "",
          };
        });

      subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
      const shipping = subtotal >= 299 || subtotal === 0 ? 0 : 49.0;
      const taxResult = calculateOrderTax({
        items,
        shippingFee: shipping,
      });

      return {
        itemCount,
        subtotal,
        shipping,
        tax: taxResult.tax,
        taxBreakdown: taxResult.taxBreakdown,
        total: taxResult.grandTotal,
        currency: "INR",
        items,
      };
    } else {
      // In-memory offline fallback
      const userItems = memoryCarts.get(userId) || [];
      if (userItems.length === 0) {
        return {
          itemCount: 0,
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0,
          currency: "INR",
          items: [],
        };
      }

      let subtotal = 0;
      let itemCount = 0;

      const items = userItems
        .filter((item) => item.product)
        .map((item) => {
          const p = item.product;
          const qty = item.quantity || 1;
          const price = typeof p.price === "number" ? p.price : 0;
          const lineTotal = Math.round(price * qty * 100) / 100;
          subtotal += lineTotal;
          itemCount += qty;

          return {
            productId: p._id || p.id,
            name: p.productName || p.name || "Product",
            price,
            quantity: qty,
            lineTotal,
            inStock: (p.stock !== undefined ? p.stock : 99) >= qty,
            seller: p.sellerName || "Store",
            productImage: p.productImage || "",
            hsnCode: p.hsnCode || "8518",
            gstRate: p.gstRate !== undefined ? p.gstRate : 18,
          };
        });

      subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
      const shipping = subtotal >= 299 || subtotal === 0 ? 0 : 49.0;
      const taxResult = calculateOrderTax({
        items,
        shippingFee: shipping,
      });

      return {
        itemCount,
        subtotal,
        shipping,
        tax: taxResult.tax,
        taxBreakdown: taxResult.taxBreakdown,
        total: taxResult.grandTotal,
        currency: "INR",
        items,
      };
    }
  }
}
