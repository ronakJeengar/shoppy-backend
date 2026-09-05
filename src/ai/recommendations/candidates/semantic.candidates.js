import mongoose from "mongoose";
import { defaultProductSearchIndex } from "../../search/productSearchIndex.js";
import { buildProductDocument } from "../../search/productDocumentBuilder.js";
import { Product } from "../../../models/product.model.js";

const fallbackProducts = [
  {
    _id: "64f2b1a2b3c4d5e6f7a8b001",
    productName: "Wireless Noise-Cancelling Headphones",
    sellerName: "SoundTech Official",
    description:
      "High-fidelity wireless headphones with dynamic 40mm drivers, active noise cancellation, 30-hour battery life, and comfortable memory foam earcups.",
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
    description:
      "Advanced health monitoring smartwatch featuring heart rate tracking, blood oxygen sensor, GPS route tracking, and water resistance up to 50m.",
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
    description:
      "Hot-swappable mechanical gaming and typing keyboard with custom linear switches, PBT keycaps, and customizable per-key RGB backlighting.",
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
    description:
      "Breathable mesh running sneakers with responsive foam midsole, shock absorption, and high-traction rubber outsole for long distance runs.",
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
    description:
      "Ceramic pour-over cone designed with spiral ribs for optimal extraction flow rate. Includes reusable stainless steel mesh filter.",
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
    description:
      "Double-walled vacuum insulated thermal flask keeping liquids icy cold for 24 hours or steaming hot for 12 hours. BPA-free leakproof lid.",
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
    description:
      "Premium 120gsm fountain-pen friendly archival paper, expanding back pocket, dual ribbon bookmarks, and durable vegan leather cover.",
    price: 18.5,
    stock: 90,
    productRating: 4.8,
    category: { _id: "64f1a2b3c4d5e6f7a8b9c005", name: "books & stationery" },
    isActive: true,
  },
];

export class SemanticCandidateGenerator {
  constructor({ productIndex = defaultProductSearchIndex } = {}) {
    this.productIndex = productIndex;
  }

  async ensureIndex() {
    if ((await this.productIndex.count()) === 0) {
      if (mongoose.connection.readyState === 1) {
        const products = await Product.find({ isActive: true })
          .populate("category", "name")
          .lean();
        await this.productIndex.indexBatch(products);
      } else {
        await this.productIndex.indexBatch(fallbackProducts);
      }
    }
  }

  /**
   * Generates candidate product IDs semantically similar to a target product or text query.
   */
  async getCandidates(targetProductOrId, { topK = 20, minScore = 0.2 } = {}) {
    await this.ensureIndex();

    let targetDocText = "";
    let targetId = null;

    if (typeof targetProductOrId === "object" && targetProductOrId !== null) {
      targetId = String(targetProductOrId._id || targetProductOrId.id || "");
      targetDocText = buildProductDocument(targetProductOrId);
    } else if (typeof targetProductOrId === "string") {
      targetId = targetProductOrId;
      // Look up product in DB or fallback
      let found = null;
      if (mongoose.connection.readyState === 1) {
        found = await Product.findById(targetProductOrId).populate("category", "name").lean();
      } else {
        found = fallbackProducts.find((p) => String(p._id) === String(targetProductOrId));
      }

      if (found) {
        targetDocText = buildProductDocument(found);
      } else {
        targetDocText = targetProductOrId; // query string fallback
      }
    }

    if (!targetDocText) return [];

    const candidates = await this.productIndex.searchCandidates(targetDocText, {
      topK: topK + 5,
    });

    return candidates
      .filter((c) => String(c.productId) !== targetId && c.score >= minScore)
      .slice(0, topK)
      .map((c) => ({
        productId: String(c.productId),
        score: c.score,
        source: "semantic",
        reason: "Similar features and specifications",
      }));
  }
}

export const defaultSemanticCandidateGenerator = new SemanticCandidateGenerator();
