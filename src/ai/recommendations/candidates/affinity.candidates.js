import mongoose from "mongoose";
import { defaultInteractionService } from "../interaction.service.js";
import { recommendationConfig } from "../config/recommendation.config.js";
import { Product } from "../../../models/product.model.js";
import { Cart } from "../../../models/cart.model.js";
import { Wishlist } from "../../../models/wishlist.model.js";
import { Order } from "../../../models/order.model.js";
import { memoryCarts } from "../../../controllers/cart.controller.js";
import { memoryWishlists } from "../../../controllers/wishlist.controller.js";
import { inMemoryOrders } from "../../../controllers/order.controller.js";

const fallbackProducts = [
  {
    _id: "64f2b1a2b3c4d5e6f7a8b001",
    productName: "Wireless Noise-Cancelling Headphones",
    sellerName: "SoundTech Official",
    price: 149.99,
    stock: 45,
    productRating: 4.8,
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
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b003",
    productName: "Ergonomic Mechanical Keyboard RGB",
    sellerName: "KeyCraft Innovations",
    price: 89.99,
    stock: 60,
    productRating: 4.7,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b004",
    productName: "Ultra-Lightweight Running Shoes",
    sellerName: "AeroStep Athletics",
    price: 79.99,
    stock: 35,
    productRating: 4.4,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c002", name: "footwear & apparel" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b005",
    productName: "Precision Pour-Over Coffee Dripper",
    sellerName: "Artisan Brewware",
    price: 34.0,
    stock: 50,
    productRating: 4.5,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c003", name: "home & kitchen" },
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b006",
    productName: "Pro Insulated Stainless Water Bottle 1L",
    sellerName: "Summit Outdoors",
    price: 24.99,
    stock: 80,
    productRating: 4.9,
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
    category: { _id: "64f1a2b3c4d5e6f7a8b9c005", name: "books & stationery" },
    isActive: true,
  },
];

export class AffinityCandidateGenerator {
  constructor({ interactionService = defaultInteractionService } = {}) {
    this.interactionService = interactionService;
  }

  /**
   * Calculates recency decay factor e^(-lambda * days).
   * Half-life is 14 days by default.
   */
  calculateRecencyDecay(date) {
    if (!date) return 1.0;
    const daysElapsed = Math.max(
      0,
      (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const halfLife = recommendationConfig.recencyHalfLifeDays || 14;
    const lambda = Math.LN2 / halfLife;
    return Math.exp(-lambda * daysElapsed);
  }

  /**
   * Aggregates user behavior across orders, cart, wishlist, and interaction events.
   * Returns category affinity scores and interacted product IDs.
   */
  async buildUserProfile(userId) {
    if (!userId) {
      return { categoryScores: new Map(), interactedProductIds: new Set() };
    }

    const userIdStr = String(userId);
    const categoryScores = new Map(); // categoryId/name -> cumulative weight
    const interactedProductIds = new Set();
    const weights = recommendationConfig.behaviorWeights;

    // 1. Ingest Interaction Events (views, clicks)
    const events = await this.interactionService.getUserInteractions(userIdStr, { limit: 50 });
    for (const ev of events) {
      if (ev.product) interactedProductIds.add(String(ev.product));
      if (ev.category) {
        const catKey = String(ev.category).toLowerCase();
        const baseWeight = weights[ev.eventType] || weights.VIEW_PRODUCT;
        const decay = this.calculateRecencyDecay(ev.createdAt || ev.timestamp);
        categoryScores.set(catKey, (categoryScores.get(catKey) || 0) + baseWeight * decay);
      }
    }

    // 2. Ingest Active Cart Items
    let cartItems = [];
    if (mongoose.connection.readyState === 1) {
      try {
        const cartDoc = await Cart.findOne({ user: userId }).populate("items.product").lean();
        if (cartDoc?.items) cartItems = cartDoc.items;
      } catch (_) {}
    } else {
      cartItems = memoryCarts.get(userIdStr) || [];
    }

    for (const item of cartItems) {
      const p = item.product || item;
      const pid = String(p._id || p.id || p.productId || "");
      if (pid) interactedProductIds.add(pid);
      const cat = p.category?.name || p.category;
      if (cat) {
        const catKey = String(typeof cat === "object" ? cat._id || cat.name : cat).toLowerCase();
        categoryScores.set(catKey, (categoryScores.get(catKey) || 0) + weights.ADD_TO_CART);
      }
    }

    // 3. Ingest Wishlist Items
    let wishlistItems = [];
    if (mongoose.connection.readyState === 1) {
      try {
        const wlDoc = await Wishlist.findOne({ user: userId }).populate("products").lean();
        if (wlDoc?.products) wishlistItems = wlDoc.products;
      } catch (_) {}
    } else {
      const ids = memoryWishlists.get(userIdStr) || [];
      wishlistItems = fallbackProducts.filter((p) => ids.includes(String(p._id)));
    }

    for (const p of wishlistItems) {
      const pid = String(p._id || p.id || "");
      if (pid) interactedProductIds.add(pid);
      const cat = p.category?.name || p.category;
      if (cat) {
        const catKey = String(typeof cat === "object" ? cat._id || cat.name : cat).toLowerCase();
        categoryScores.set(catKey, (categoryScores.get(catKey) || 0) + weights.WISHLIST_ADD);
      }
    }

    // 4. Ingest Historical Purchases
    let orders = [];
    if (mongoose.connection.readyState === 1) {
      try {
        orders = await Order.find({ customer: userId, orderStatus: { $ne: "CANCELLED" } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();
      } catch (_) {}
    } else {
      orders = Array.from(inMemoryOrders.values()).filter(
        (o) => String(o.customer || o.user) === userIdStr && o.orderStatus !== "CANCELLED"
      );
    }

    for (const ord of orders) {
      const decay = this.calculateRecencyDecay(ord.createdAt);
      for (const it of ord.items || []) {
        const pid = String(it.productId || it._id || "");
        if (pid) interactedProductIds.add(pid);
        // Look up product to find category if not embedded
        const match = fallbackProducts.find((p) => String(p._id) === pid);
        if (match?.category) {
          const catKey = String(match.category._id || match.category.name).toLowerCase();
          categoryScores.set(
            catKey,
            (categoryScores.get(catKey) || 0) + weights.PURCHASE * decay
          );
        }
      }
    }

    return { categoryScores, interactedProductIds };
  }

  /**
   * Generates candidate products based on user category affinity.
   */
  async getCandidates(userId, { topK = 20 } = {}) {
    const { categoryScores, interactedProductIds } = await this.buildUserProfile(userId);

    if (categoryScores.size === 0) {
      return [];
    }

    // Find maximum score for normalization
    let maxScore = 1;
    for (const score of categoryScores.values()) {
      if (score > maxScore) maxScore = score;
    }

    // Sort categories by score descending
    const sortedCategories = Array.from(categoryScores.entries()).sort((a, b) => b[1] - a[1]);
    const topCategoryKeys = sortedCategories.slice(0, 3).map((e) => e[0]);

    // Retrieve active candidate products matching top categories
    let pool = [];
    if (mongoose.connection.readyState === 1) {
      try {
        pool = await Product.find({ isActive: true })
          .populate("category", "name")
          .limit(50)
          .lean();
      } catch (_) {}
    }
    if (pool.length === 0) {
      pool = fallbackProducts;
    }

    const candidates = [];
    for (const product of pool) {
      const pid = String(product._id || product.id);
      const catObj = product.category;
      const catIdStr = String(catObj?._id || "").toLowerCase();
      const catNameStr = String(catObj?.name || catObj || "").toLowerCase();

      let matchedAffinityScore = 0;
      let matchedCatName = catNameStr;

      if (categoryScores.has(catIdStr)) {
        matchedAffinityScore = categoryScores.get(catIdStr);
      } else if (categoryScores.has(catNameStr)) {
        matchedAffinityScore = categoryScores.get(catNameStr);
      }

      if (matchedAffinityScore > 0) {
        const normalized = Math.min(1.0, matchedAffinityScore / maxScore);
        candidates.push({
          productId: pid,
          score: normalized,
          source: "affinity",
          reason: `Popular in ${matchedCatName || "categories you like"}`,
        });
      }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

export const defaultAffinityCandidateGenerator = new AffinityCandidateGenerator();
