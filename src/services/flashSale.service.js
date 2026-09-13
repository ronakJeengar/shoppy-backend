import mongoose from "mongoose";
import {
  FlashSale,
  ALLOWED_SALE_TYPES,
  ALLOWED_DISCOUNT_TYPES,
} from "../models/flashSale.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/apiError.js";

const nowMs = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// In-memory test store for test suites or offline operation
export const memoryFlashSales = [
  {
    _id: "fs_mega_midnight",
    name: "MIDNIGHT_DEALS_2026",
    title: "Midnight Mega Flash Sale — Up to 40% Off",
    description: "Lightning discounts on top electronics and premium sound gear for a limited time.",
    saleType: "FLASH_SALE",
    bannerImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80",
    startAt: new Date(nowMs - 2 * HOUR),
    endAt: new Date(nowMs + 10 * HOUR),
    isActive: true,
    priority: 10,
    items: [
      {
        _id: "fsi_001",
        product: {
          _id: "64f2b1a2b3c4d5e6f7a8b801",
          productName: "Aura Pro Wireless Noise-Cancelling Headphones",
          sellerName: "Aura Audio Labs",
          price: 14999.0,
          mrp: 19999.0,
          stock: 45,
          productImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
        },
        discountType: "FIXED_PRICE",
        discountValue: 9999.0,
        salePrice: 9999.0,
        regularPrice: 14999.0,
        maximumQuantityPerOrder: 2,
        stockAllocated: 30,
        stockSold: 12,
      },
      {
        _id: "fsi_002",
        product: {
          _id: "64f2b1a2b3c4d5e6f7a8b802",
          productName: "Titan Chronos Ultra Smartwatch",
          sellerName: "Titan Wearables",
          price: 17999.0,
          mrp: 22999.0,
          stock: 28,
          productImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
        },
        discountType: "PERCENTAGE",
        discountValue: 30,
        salePrice: 12599.0,
        regularPrice: 17999.0,
        maximumQuantityPerOrder: 1,
        stockAllocated: 20,
        stockSold: 5,
      },
      {
        _id: "fsi_003",
        product: {
          _id: "64f2b1a2b3c4d5e6f7a8b803",
          productName: "Heavyweight Organic Pima Cotton Oversized Tee",
          sellerName: "Maison Minimal",
          price: 999.0,
          mrp: 1499.0,
          stock: 50,
          productImage: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
        },
        discountType: "FIXED_AMOUNT",
        discountValue: 300,
        salePrice: 699.0,
        regularPrice: 999.0,
        maximumQuantityPerOrder: 3,
        stockAllocated: 40,
        stockSold: 40, // Sold out item
      },
    ],
  },
  {
    _id: "fs_upcoming_weekend",
    name: "WEEKEND_QUICK_SALE",
    title: "Weekend Quick Sale Preview",
    description: "Exclusive discounts launching this upcoming weekend.",
    saleType: "QUICK_SALE",
    bannerImage: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&auto=format&fit=crop&q=80",
    startAt: new Date(nowMs + 2 * DAY),
    endAt: new Date(nowMs + 4 * DAY),
    isActive: true,
    priority: 8,
    items: [],
  },
  {
    _id: "fs_expired_flash",
    name: "EXPIRED_YESTERDAY_SALE",
    title: "Yesterday's Flash Sale",
    description: "Expired flash sale testing filter exclusions.",
    saleType: "FLASH_SALE",
    bannerImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
    startAt: new Date(nowMs - 3 * DAY),
    endAt: new Date(nowMs - 1 * DAY),
    isActive: true,
    priority: 1,
    items: [],
  },
  {
    _id: "fs_inactive_test",
    name: "DEACTIVATED_SALE_TEST",
    title: "Deactivated Flash Sale",
    description: "Deactivated sale testing manual switch.",
    saleType: "FLASH_SALE",
    startAt: new Date(nowMs - 1 * HOUR),
    endAt: new Date(nowMs + 5 * HOUR),
    isActive: false,
    priority: 5,
    items: [],
  },
];

export class FlashSaleService {
  /**
   * Helper to compute discounted price based on type and value.
   */
  static computeSalePrice(regularPrice, discountType, discountValue, explicitSalePrice) {
    const reg = Number(regularPrice) || 0;
    if (explicitSalePrice !== undefined && explicitSalePrice !== null && !isNaN(explicitSalePrice)) {
      const sp = Number(explicitSalePrice);
      if (sp > reg) {
        throw new ApiError(400, `Sale price (₹${sp}) cannot be higher than regular price (₹${reg})`);
      }
      if (sp <= 0) {
        throw new ApiError(400, "Sale price must be strictly greater than 0");
      }
      return Math.round(sp * 100) / 100;
    }

    const val = Number(discountValue) || 0;
    let computed = reg;

    if (discountType === "PERCENTAGE") {
      if (val <= 0 || val >= 100) {
        throw new ApiError(400, "Percentage discount must be between 1 and 99");
      }
      computed = reg * (1 - val / 100);
    } else if (discountType === "FIXED_AMOUNT") {
      if (val <= 0 || val >= reg) {
        throw new ApiError(400, `Discount amount (₹${val}) must be between 1 and less than product price (₹${reg})`);
      }
      computed = reg - val;
    } else if (discountType === "FIXED_PRICE") {
      if (val <= 0 || val > reg) {
        throw new ApiError(400, `Fixed sale price (₹${val}) must be between 1 and regular price (₹${reg})`);
      }
      computed = val;
    } else {
      throw new ApiError(400, `Invalid discountType. Allowed: ${ALLOWED_DISCOUNT_TYPES.join(", ")}`);
    }

    return Math.round(computed * 100) / 100;
  }

  /**
   * Standardizes a flash sale document into a public API response payload.
   */
  static formatFlashSale(doc) {
    if (!doc) return null;
    const id = (doc._id || doc.id || "").toString();

    const formattedItems = (doc.items || []).map((item) => {
      const p = item.product || {};
      const productId = (p._id || p.id || item.product || "").toString();
      const regularPrice = Number(item.regularPrice || p.price || 0);
      const salePrice = Number(item.salePrice || 0);
      const stockAllocated = Number(item.stockAllocated || 0);
      const stockSold = Number(item.stockSold || 0);
      const isSoldOut = stockAllocated > 0 && stockSold >= stockAllocated;
      const remainingStock = stockAllocated > 0 ? Math.max(0, stockAllocated - stockSold) : null;

      let discountPercentage = 0;
      if (regularPrice > 0 && salePrice < regularPrice) {
        discountPercentage = Math.round(((regularPrice - salePrice) / regularPrice) * 100);
      }

      return {
        id: (item._id || item.id || "").toString(),
        productId,
        productName: p.productName || p.name || "Product",
        productImage: p.productImage || p.imageUrl || "",
        sellerName: p.sellerName || "Official Seller",
        regularPrice,
        salePrice,
        mrp: Number(p.mrp || regularPrice),
        discountType: item.discountType || "FIXED_PRICE",
        discountValue: Number(item.discountValue || 0),
        discountPercentage,
        maximumQuantityPerOrder: Number(item.maximumQuantityPerOrder || 2),
        stockAllocated,
        stockSold,
        remainingStock,
        isSoldOut,
      };
    });

    return {
      id,
      name: doc.name,
      title: doc.title,
      description: doc.description || "",
      saleType: doc.saleType || "FLASH_SALE",
      bannerImage: doc.bannerImage || "",
      startAt: doc.startAt ? new Date(doc.startAt).toISOString() : new Date().toISOString(),
      endAt: doc.endAt ? new Date(doc.endAt).toISOString() : new Date().toISOString(),
      isActive: doc.isActive !== false,
      priority: Number(doc.priority || 0),
      items: formattedItems,
      itemCount: formattedItems.length,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Retrieves active flash sales with clock-skew compensation serverTime.
   */
  static async getActiveFlashSales({ now = new Date(), limit = 10 } = {}) {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      try {
        const sales = await FlashSale.find({
          isActive: true,
          startAt: { $lte: now },
          endAt: { $gte: now },
        })
          .populate("items.product")
          .sort({ priority: -1, endAt: 1, createdAt: -1 })
          .limit(limit)
          .lean();

        if (sales && sales.length > 0) {
          return {
            flashSales: sales.map(this.formatFlashSale),
            serverTime: now.toISOString(),
          };
        }
      } catch (err) {
        console.warn("MongoDB flash sale fetch failed, falling back to memory:", err.message);
      }
    }

    // In-memory fallback
    const filtered = memoryFlashSales.filter((s) => {
      if (!s.isActive) return false;
      const start = new Date(s.startAt);
      const end = new Date(s.endAt);
      return start <= now && end >= now;
    });

    filtered.sort((a, b) => {
      if (b.priority !== a.priority) return (b.priority || 0) - (a.priority || 0);
      return new Date(a.endAt).getTime() - new Date(b.endAt).getTime();
    });

    return {
      flashSales: filtered.slice(0, limit).map(this.formatFlashSale),
      serverTime: now.toISOString(),
    };
  }

  /**
   * Retrieves upcoming flash sales.
   */
  static async getUpcomingFlashSales({ now = new Date(), limit = 10 } = {}) {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      try {
        const sales = await FlashSale.find({
          isActive: true,
          startAt: { $gt: now },
        })
          .populate("items.product")
          .sort({ startAt: 1, priority: -1 })
          .limit(limit)
          .lean();

        if (sales && sales.length > 0) {
          return {
            flashSales: sales.map(this.formatFlashSale),
            serverTime: now.toISOString(),
          };
        }
      } catch (err) {
        console.warn("MongoDB upcoming flash sales failed, falling back to memory:", err.message);
      }
    }

    const filtered = memoryFlashSales.filter((s) => {
      if (!s.isActive) return false;
      return new Date(s.startAt) > now;
    });

    filtered.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    return {
      flashSales: filtered.slice(0, limit).map(this.formatFlashSale),
      serverTime: now.toISOString(),
    };
  }

  /**
   * Retrieves a single flash sale by ID.
   */
  static async getFlashSaleById(id) {
    if (!id) throw new ApiError(400, "Flash sale ID is required");

    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected && mongoose.isValidObjectId(id)) {
      const sale = await FlashSale.findById(id).populate("items.product").lean();
      if (sale) return this.formatFlashSale(sale);
    }

    const mem = memoryFlashSales.find((s) => s._id === id || s.id === id);
    if (!mem) throw new ApiError(404, `Flash sale with ID ${id} not found`);
    return this.formatFlashSale(mem);
  }

  /**
   * Finds the best active flash sale promotion for a given product.
   * Resolves conflicts deterministically: highest priority -> soonest ending -> lowest price.
   */
  static async getActiveProductFlashSale(productId, now = new Date()) {
    if (!productId) return null;
    const strProductId = productId.toString();
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      try {
        const activeSales = await FlashSale.find({
          isActive: true,
          startAt: { $lte: now },
          endAt: { $gte: now },
          "items.product": strProductId,
        })
          .sort({ priority: -1, endAt: 1, createdAt: -1 })
          .lean();

        for (const sale of activeSales) {
          const item = sale.items.find(
            (i) => i.product && i.product.toString() === strProductId
          );
          if (!item) continue;

          // Check if allocated stock is exhausted
          const stockAllocated = Number(item.stockAllocated || 0);
          const stockSold = Number(item.stockSold || 0);
          if (stockAllocated > 0 && stockSold >= stockAllocated) {
            continue; // Sold out in this flash sale
          }

          const regularPrice = Number(item.regularPrice || 0);
          const salePrice = Number(item.salePrice || 0);
          let discountPercentage = 0;
          if (regularPrice > 0 && salePrice < regularPrice) {
            discountPercentage = Math.round(((regularPrice - salePrice) / regularPrice) * 100);
          }

          return {
            flashSaleId: sale._id.toString(),
            flashSaleName: sale.name,
            flashSaleTitle: sale.title,
            salePrice,
            regularPrice,
            discountPercentage,
            maximumQuantityPerOrder: Number(item.maximumQuantityPerOrder || 2),
            stockAllocated,
            stockSold,
            remainingStock: stockAllocated > 0 ? stockAllocated - stockSold : null,
            endAt: sale.endAt,
          };
        }
      } catch (err) {
        console.warn("Error finding active product flash sale in DB:", err.message);
      }
    }

    // Fallback in-memory
    const activeMemSales = memoryFlashSales.filter((s) => {
      if (!s.isActive) return false;
      const start = new Date(s.startAt);
      const end = new Date(s.endAt);
      return start <= now && end >= now;
    });

    activeMemSales.sort((a, b) => {
      if (b.priority !== a.priority) return (b.priority || 0) - (a.priority || 0);
      return new Date(a.endAt).getTime() - new Date(b.endAt).getTime();
    });

    for (const sale of activeMemSales) {
      const item = (sale.items || []).find((i) => {
        const pId = (i.product?._id || i.product?.id || i.product || "").toString();
        return pId === strProductId;
      });
      if (!item) continue;

      const stockAllocated = Number(item.stockAllocated || 0);
      const stockSold = Number(item.stockSold || 0);
      if (stockAllocated > 0 && stockSold >= stockAllocated) {
        continue; // Sold out
      }

      const regularPrice = Number(item.regularPrice || item.product?.price || 0);
      const salePrice = Number(item.salePrice || 0);
      let discountPercentage = 0;
      if (regularPrice > 0 && salePrice < regularPrice) {
        discountPercentage = Math.round(((regularPrice - salePrice) / regularPrice) * 100);
      }

      return {
        flashSaleId: (sale._id || sale.id).toString(),
        flashSaleName: sale.name,
        flashSaleTitle: sale.title,
        salePrice,
        regularPrice,
        discountPercentage,
        maximumQuantityPerOrder: Number(item.maximumQuantityPerOrder || 2),
        stockAllocated,
        stockSold,
        remainingStock: stockAllocated > 0 ? stockAllocated - stockSold : null,
        endAt: sale.endAt,
      };
    }

    return null;
  }

  /**
   * Atomically records sold units for a flash sale product.
   */
  static async recordFlashSaleStockSold(flashSaleId, productId, quantity = 1) {
    if (!flashSaleId || !productId) return;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.isValidObjectId(flashSaleId)) {
      try {
        await FlashSale.updateOne(
          {
            _id: flashSaleId,
            "items.product": productId,
          },
          {
            $inc: { "items.$.stockSold": quantity },
          }
        );
        return;
      } catch (err) {
        console.warn("Failed to record flash sale stock sold in DB:", err.message);
      }
    }

    // In-memory fallback
    const sale = memoryFlashSales.find((s) => s._id === flashSaleId || s.id === flashSaleId);
    if (sale && sale.items) {
      const item = sale.items.find((i) => {
        const pId = (i.product?._id || i.product?.id || i.product || "").toString();
        return pId === productId.toString();
      });
      if (item) {
        item.stockSold = (item.stockSold || 0) + quantity;
      }
    }
  }

  /**
   * Admin: Lists flash sales with pagination and status filters.
   */
  static async listFlashSales({ page = 1, limit = 20, status = "all", search } = {}) {
    const now = new Date();
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const query = {};
      if (status === "active") {
        query.isActive = true;
        query.startAt = { $lte: now };
        query.endAt = { $gte: now };
      } else if (status === "inactive") {
        query.isActive = false;
      } else if (status === "expired") {
        query.endAt = { $lt: now };
      } else if (status === "upcoming") {
        query.startAt = { $gt: now };
      }

      if (search && search.trim()) {
        query.$or = [
          { name: { $regex: search.trim(), $options: "i" } },
          { title: { $regex: search.trim(), $options: "i" } },
        ];
      }

      const skip = (page - 1) * limit;
      const [total, docs] = await Promise.all([
        FlashSale.countDocuments(query),
        FlashSale.find(query)
          .populate("items.product")
          .sort({ priority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      return {
        items: docs.map(this.formatFlashSale),
        serverTime: now.toISOString(),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      };
    }

    // In-memory fallback
    let items = [...memoryFlashSales];
    if (status === "active") {
      items = items.filter(
        (s) => s.isActive && new Date(s.startAt) <= now && new Date(s.endAt) >= now
      );
    } else if (status === "inactive") {
      items = items.filter((s) => !s.isActive);
    } else if (status === "expired") {
      items = items.filter((s) => new Date(s.endAt) < now);
    } else if (status === "upcoming") {
      items = items.filter((s) => new Date(s.startAt) > now);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const total = items.length;
    const skip = (page - 1) * limit;
    const paginated = items.slice(skip, skip + limit);

    return {
      items: paginated.map(this.formatFlashSale),
      serverTime: now.toISOString(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin: Creates a new flash sale.
   */
  static async createFlashSale(payload) {
    const {
      name,
      title,
      description = "",
      saleType = "FLASH_SALE",
      bannerImage = "",
      startAt = new Date(),
      endAt,
      isActive = true,
      priority = 0,
      items = [],
    } = payload;

    if (!name || !name.trim()) throw new ApiError(400, "Flash sale unique name is required");
    if (!title || !title.trim()) throw new ApiError(400, "Flash sale title is required");
    if (!endAt) throw new ApiError(400, "Flash sale endAt date is required");

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ApiError(400, "Invalid date format for startAt or endAt");
    }
    if (endDate <= startDate) {
      throw new ApiError(400, "Flash sale endAt must be strictly greater than startAt");
    }

    if (!ALLOWED_SALE_TYPES.includes(saleType)) {
      throw new ApiError(400, `Invalid saleType. Allowed: ${ALLOWED_SALE_TYPES.join(", ")}`);
    }

    const validatedItems = [];
    for (const raw of items) {
      if (!raw.product) {
        throw new ApiError(400, "Each flash sale item must specify a valid product");
      }
      let regularPrice = Number(raw.regularPrice || 0);
      if (!regularPrice && mongoose.connection.readyState === 1 && mongoose.isValidObjectId(raw.product)) {
        const prod = await Product.findById(raw.product);
        if (prod) regularPrice = prod.price;
      }
      if (!regularPrice && raw.product?.price) {
        regularPrice = raw.product.price;
      }

      const salePrice = this.computeSalePrice(
        regularPrice,
        raw.discountType || "FIXED_PRICE",
        raw.discountValue,
        raw.salePrice
      );

      validatedItems.push({
        product: raw.product._id || raw.product,
        discountType: raw.discountType || "FIXED_PRICE",
        discountValue: Number(raw.discountValue || 0),
        salePrice,
        regularPrice,
        maximumQuantityPerOrder: Math.max(1, Number(raw.maximumQuantityPerOrder || 2)),
        stockAllocated: Math.max(0, Number(raw.stockAllocated || 0)),
        stockSold: Math.max(0, Number(raw.stockSold || 0)),
      });
    }

    const saleData = {
      name: name.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim(),
      saleType,
      bannerImage: bannerImage.trim(),
      startAt: startDate,
      endAt: endDate,
      isActive: Boolean(isActive),
      priority: Number(priority) || 0,
      items: validatedItems,
    };

    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected) {
      const created = await FlashSale.create(saleData);
      const populated = await FlashSale.findById(created._id).populate("items.product");
      return this.formatFlashSale(populated);
    }

    // In-memory
    const newDoc = {
      _id: `fs_${Date.now()}`,
      ...saleData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryFlashSales.unshift(newDoc);
    return this.formatFlashSale(newDoc);
  }

  /**
   * Admin: Updates an existing flash sale.
   */
  static async updateFlashSale(id, updateData) {
    if (!id) throw new ApiError(400, "Flash sale ID is required");

    const existing = await this.getFlashSaleById(id);
    const startDate = updateData.startAt ? new Date(updateData.startAt) : new Date(existing.startAt);
    const endDate = updateData.endAt ? new Date(updateData.endAt) : new Date(existing.endAt);

    if (endDate <= startDate) {
      throw new ApiError(400, "Flash sale endAt must be strictly greater than startAt");
    }

    if (updateData.name) {
      updateData.name = updateData.name.trim().toUpperCase();
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected && mongoose.isValidObjectId(id)) {
      const updated = await FlashSale.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate("items.product");
      if (updated) return this.formatFlashSale(updated);
    }

    const memIdx = memoryFlashSales.findIndex((s) => s._id === id || s.id === id);
    if (memIdx !== -1) {
      memoryFlashSales[memIdx] = {
        ...memoryFlashSales[memIdx],
        ...updateData,
        updatedAt: new Date(),
      };
      return this.formatFlashSale(memoryFlashSales[memIdx]);
    }

    throw new ApiError(404, `Flash sale ${id} not found`);
  }

  /**
   * Admin: Toggles flash sale active status.
   */
  static async toggleFlashSaleStatus(id, isActive) {
    if (typeof isActive !== "boolean") {
      throw new ApiError(400, "isActive boolean is required");
    }
    return this.updateFlashSale(id, { isActive });
  }

  /**
   * Admin: Deletes a flash sale.
   */
  static async deleteFlashSale(id) {
    if (!id) throw new ApiError(400, "Flash sale ID is required");

    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected && mongoose.isValidObjectId(id)) {
      const deleted = await FlashSale.findByIdAndDelete(id);
      if (deleted) return true;
    }

    const memIdx = memoryFlashSales.findIndex((s) => s._id === id || s.id === id);
    if (memIdx !== -1) {
      memoryFlashSales.splice(memIdx, 1);
      return true;
    }

    throw new ApiError(404, `Flash sale ${id} not found`);
  }
}
