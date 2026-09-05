import mongoose from "mongoose";
import { Product } from "../../../models/product.model.js";

const fallbackProducts = [
  {
    _id: "64f2b1a2b3c4d5e6f7a8b001",
    productName: "Wireless Noise-Cancelling Headphones",
    sellerName: "SoundTech Official",
    price: 149.99,
    stock: 45,
    productRating: 4.8,
    totalReviews: 120,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b006",
    productName: "Pro Insulated Stainless Water Bottle 1L",
    sellerName: "Summit Outdoors",
    price: 24.99,
    stock: 80,
    productRating: 4.9,
    totalReviews: 95,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c004", name: "sports & outdoors" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b007",
    productName: "Hardcover Dotted Grid Journal",
    sellerName: "PaperCraft Studio",
    price: 18.5,
    stock: 90,
    productRating: 4.8,
    totalReviews: 84,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c005", name: "books & stationery" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b003",
    productName: "Ergonomic Mechanical Keyboard RGB",
    sellerName: "KeyCraft Innovations",
    price: 89.99,
    stock: 60,
    productRating: 4.7,
    totalReviews: 76,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b002",
    productName: "Smart Fitness Watch Ultra",
    sellerName: "PulseTech Wearables",
    price: 199.99,
    stock: 28,
    productRating: 4.6,
    totalReviews: 62,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b005",
    productName: "Precision Pour-Over Coffee Dripper",
    sellerName: "Artisan Brewware",
    price: 34.0,
    stock: 50,
    productRating: 4.5,
    totalReviews: 45,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c003", name: "home & kitchen" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b004",
    productName: "Ultra-Lightweight Running Shoes",
    sellerName: "AeroStep Athletics",
    price: 79.99,
    stock: 35,
    productRating: 4.4,
    totalReviews: 38,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c002", name: "footwear & apparel" },
    isActive: true,
  },
];

export class TrendingCandidateGenerator {
  /**
   * Generates candidate products ordered by popularity, rating, and stock health.
   */
  async getCandidates({ limit = 20, categoryId = null } = {}) {
    let pool = [];

    if (mongoose.connection.readyState === 1) {
      try {
        const query = { isActive: true, stock: { $gt: 0 } };
        if (categoryId) {
          query.category = categoryId;
        }
        pool = await Product.find(query)
          .sort({ productRating: -1, totalReviews: -1, createdAt: -1 })
          .limit(limit)
          .lean();
      } catch (err) {
        console.warn("TrendingCandidateGenerator: Mongo error:", err.message);
      }
    }

    if (pool.length === 0) {
      pool = fallbackProducts.filter(
        (p) =>
          p.isActive !== false &&
          p.stock > 0 &&
          (!categoryId ||
            String(p.category?._id || p.category) === String(categoryId))
      );
    }

    return pool.map((p, idx) => {
      const pid = String(p._id || p.id);
      const rating = p.productRating || 4.5;
      const normalizedScore = Math.max(0.1, Math.min(1.0, rating / 5.0 - idx * 0.03));

      return {
        productId: pid,
        score: normalizedScore,
        source: "trending",
        reason:
          rating >= 4.8
            ? "Top-rated by verified buyers"
            : "Popular and trending today",
      };
    });
  }
}

export const defaultTrendingCandidateGenerator = new TrendingCandidateGenerator();
