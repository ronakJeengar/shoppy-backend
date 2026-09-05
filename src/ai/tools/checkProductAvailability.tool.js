import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Product } from "../../models/product.model.js";
import { memoryAdminStore } from "../../controllers/admin.controller.js";

export class CheckProductAvailabilityTool extends AITool {
  constructor() {
    super({
      name: "check_product_availability",
      description:
        "Check authoritative real-time inventory count and stock availability status for a specific product ID.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The unique product ID to check availability for",
          },
        },
        required: ["productId"],
      },
      requiresAuth: false,
      sideEffectType: "READ_ONLY",
      timeout: 3000,
      idempotent: true,
    });
  }

  async execute({ productId }, context) {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(productId)) {
      const product = await Product.findById(productId);
      if (!product || product.isActive === false) {
        return {
          productId,
          exists: false,
          inStock: false,
          stockCount: 0,
          status: "DISCONTINUED_OR_UNAVAILABLE",
          message: "Product not found or is currently inactive",
        };
      }

      const inStock = (product.stock ?? 0) > 0;
      return {
        productId: product._id.toString(),
        productName: product.productName,
        exists: true,
        inStock,
        stockCount: product.stock ?? 0,
        price: product.price,
        status: inStock ? (product.stock < 5 ? "LOW_STOCK" : "IN_STOCK") : "OUT_OF_STOCK",
        message: inStock
          ? `In stock with ${product.stock} units available`
          : "Currently out of stock",
      };
    }

    // In-memory fallback
    const fallbackProducts = [
      {
        id: "64f2b1a2b3c4d5e6f7a8b001",
        _id: "64f2b1a2b3c4d5e6f7a8b001",
        name: "Wireless Noise-Cancelling Headphones",
        price: 149.99,
        stock: 45,
        isActive: true,
      },
      {
        id: "64f2b1a2b3c4d5e6f7a8b002",
        _id: "64f2b1a2b3c4d5e6f7a8b002",
        name: "Smart Fitness Watch Ultra",
        price: 199.99,
        stock: 28,
        isActive: true,
      },
      {
        id: "64f2b1a2b3c4d5e6f7a8b003",
        _id: "64f2b1a2b3c4d5e6f7a8b003",
        name: "Classic Organic Cotton Crewneck",
        price: 29.99,
        stock: 120,
        isActive: true,
      },
    ];

    const adminCatalog = memoryAdminStore?.products || [];
    const combined = [...adminCatalog, ...fallbackProducts];

    const match = combined.find(
      (p) =>
        (p._id && p._id.toString() === productId.toString()) ||
        (p.id && p.id.toString() === productId.toString())
    );

    if (!match || match.isActive === false) {
      return {
        productId,
        exists: false,
        inStock: false,
        stockCount: 0,
        status: "DISCONTINUED_OR_UNAVAILABLE",
        message: "Product not found or is currently inactive",
      };
    }

    const stock = match.stock ?? 25;
    const inStock = stock > 0;

    return {
      productId: (match._id || match.id).toString(),
      productName: match.name || match.productName || "Product",
      exists: true,
      inStock,
      stockCount: stock,
      price: match.price,
      status: inStock ? (stock < 5 ? "LOW_STOCK" : "IN_STOCK") : "OUT_OF_STOCK",
      message: inStock
        ? `In stock with ${stock} units available`
        : "Currently out of stock",
    };
  }
}
