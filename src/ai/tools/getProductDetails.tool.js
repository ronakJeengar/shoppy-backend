import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Product } from "../../models/product.model.js";
import { memoryAdminStore } from "../../controllers/admin.controller.js";

export class GetProductDetailsTool extends AITool {
  constructor() {
    super({
      name: "get_product_details",
      description: "Retrieve verified details and live inventory for a specific product ID.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The unique product identifier",
          },
        },
        required: ["productId"],
      },
      requiresAuth: false,
    });
  }

  async execute({ productId }, context) {
    if (!productId) {
      return { error: "productId parameter is required" };
    }

    const pIdStr = String(productId).trim();

    if (mongoose.connection.readyState === 1) {
      if (!mongoose.Types.ObjectId.isValid(pIdStr)) {
        return { exists: false, error: "Invalid product ID format" };
      }

      const product = await Product.findById(pIdStr).lean();
      if (!product || product.isActive === false) {
        return { exists: false, message: "Product not found or is no longer active" };
      }

      return {
        exists: true,
        id: product._id,
        name: product.productName,
        description: product.description,
        price: product.price,
        inStock: product.stock > 0,
        stockCount: product.stock,
        rating: product.productRating,
        totalReviews: product.totalReviews || 0,
        seller: product.sellerName,
      };
    } else {
      const prod = memoryAdminStore.products.find(
        (p) => (p._id || p.id).toString() === pIdStr && p.isActive !== false
      );

      if (!prod) {
        return { exists: false, message: "Product not found or is no longer active" };
      }

      return {
        exists: true,
        id: prod._id || prod.id,
        name: prod.productName,
        description: prod.description,
        price: prod.price,
        inStock: (prod.stock || 0) > 0,
        stockCount: prod.stock || 0,
        rating: prod.productRating || 0,
        totalReviews: prod.totalReviews || 0,
        seller: prod.sellerName || "Store",
      };
    }
  }
}
