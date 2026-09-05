import mongoose from "mongoose";
import { Product } from "../../../models/product.model.js";
const fallbackProducts = [
  {
    _id: "64f2b1a2b3c4d5e6f7a8b001",
    productName: "Wireless Noise-Cancelling Headphones",
    price: 149.99,
    stock: 45,
    productRating: 4.8,
    totalReviews: 24,
    category: { name: "electronics" },
    description: "High-fidelity wireless headphones with dynamic 40mm drivers and active noise cancellation.",
    productImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b002",
    productName: "Smart Fitness Watch Ultra",
    price: 199.99,
    stock: 28,
    productRating: 4.6,
    totalReviews: 19,
    category: { name: "electronics" },
    description: "Advanced health monitoring smartwatch featuring heart rate tracking and GPS.",
    productImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
    isActive: true,
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b003",
    productName: "Classic Organic Cotton Crewneck",
    price: 29.99,
    stock: 120,
    productRating: 4.7,
    totalReviews: 42,
    category: { name: "fashion" },
    description: "Tailored 100% certified organic cotton tee with reinforced stitching.",
    productImage: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
    isActive: true,
  },
];
import { McpError } from "../protocol/mcpErrors.js";

export class ResourceRegistry {
  constructor() {
    this.staticResources = new Map([
      [
        "shoppy://policies/returns",
        {
          uri: "shoppy://policies/returns",
          name: "Shoppy Store Return Policy",
          description: "Authoritative return eligibility, 30-day window, and refund procedures",
          mimeType: "application/json",
          handler: () => ({
            policy: "Return & Refund Policy",
            windowDays: 30,
            conditions: [
              "Items must be in original condition with all tags attached",
              "Original receipt or proof of purchase required",
              "Electronics must include original cables and manuals",
            ],
            refundMethod: "Refunded to original payment method within 5-7 business days of receipt",
            freeReturns: true,
            exclusions: ["Perishable goods", "Gift cards", "Downloadable software products"],
          }),
        },
      ],
      [
        "shoppy://policies/shipping",
        {
          uri: "shoppy://policies/shipping",
          name: "Shoppy Shipping & Delivery Policy",
          description: "Delivery timelines, expedited options, and free shipping thresholds",
          mimeType: "application/json",
          handler: () => ({
            policy: "Shipping & Fulfillment Terms",
            standardDelivery: "3 to 5 business days nationwide",
            expressDelivery: "1 to 2 business days for orders confirmed prior to 2:00 PM",
            freeShippingThreshold: 50.0,
            standardShippingFee: 4.99,
            carriers: ["ShoppyExpress", "FedEx", "DHL", "BlueDart"],
          }),
        },
      ],
      [
        "shoppy://faq",
        {
          uri: "shoppy://faq",
          name: "Shoppy Customer FAQ",
          description: "Frequently asked questions covering payments, order changes, and warranties",
          mimeType: "application/json",
          handler: () => ({
            faqs: [
              {
                question: "What payment methods are accepted?",
                answer: "Shoppy accepts Major Credit/Debit cards, UPI, Net Banking, and Cash on Delivery (COD).",
              },
              {
                question: "How do I track my shipment?",
                answer: "You can track your order status in real time via the Orders tab in the Shoppy app or through the assistant using get_user_order_status.",
              },
              {
                question: "What warranty coverage is included?",
                answer: "All electronics carry a minimum 1-year manufacturer warranty covering internal hardware defects.",
              },
              {
                question: "Can I cancel an order after placing it?",
                answer: "Orders in CONFIRMED state can be cancelled for an immediate refund. Once an order enters SHIPPED status, it must be returned via our standard return process.",
              },
            ],
          }),
        },
      ],
    ]);
  }

  /**
   * List all discoverable resources.
   */
  listResources() {
    const list = [];
    for (const res of this.staticResources.values()) {
      list.push({
        uri: res.uri,
        name: res.name,
        description: res.description,
        mimeType: res.mimeType,
      });
    }

    // Dynamic product resource template
    list.push({
      uri: "shoppy://products/{id}",
      name: "Product Catalog Resource",
      description: "Live, authoritative product details, price, inventory stock, and ratings by product ID",
      mimeType: "application/json",
    });

    return list;
  }

  /**
   * Read resource contents by URI.
   */
  async readResource(uri) {
    if (!uri || typeof uri !== "string") {
      throw McpError.invalidParams("URI must be a non-empty string");
    }

    // 1. Static resources
    if (this.staticResources.has(uri)) {
      const res = this.staticResources.get(uri);
      const data = res.handler();
      return {
        contents: [
          {
            uri: res.uri,
            mimeType: res.mimeType,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    // 2. Dynamic product URI: shoppy://products/{id}
    const productMatch = uri.match(/^shoppy:\/\/products\/([a-zA-Z0-9_-]+)$/);
    if (productMatch) {
      const productId = productMatch[1];
      let product = null;

      if (mongoose.connection.readyState === 1) {
        try {
          product = await Product.findOne({ _id: productId, isActive: true })
            .populate("category", "name")
            .lean();
        } catch (err) {
          // If invalid ObjectId, will fall back
        }
      }

      if (!product) {
        product = fallbackProducts.find(
          (p) => String(p._id) === String(productId) && p.isActive !== false
        );
      }

      if (!product) {
        throw McpError.resourceNotFound(uri);
      }

      const safeProductData = {
        id: String(product._id || product.id),
        name: product.productName,
        price: product.price,
        stock: product.stock,
        isInStock: product.stock > 0,
        rating: product.productRating || 0,
        totalReviews: product.totalReviews || 0,
        category: product.category?.name || product.category || "General",
        description: product.description || "",
        imageUrl: product.productImage || "",
      };

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(safeProductData, null, 2),
          },
        ],
      };
    }

    throw McpError.resourceNotFound(uri);
  }
}

export const defaultResourceRegistry = new ResourceRegistry();
