import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";
import { Category } from "../models/category.model.js";
import { Order } from "../models/order.model.js";
import { Payment } from "../models/payment.model.js";
import { AuditLog } from "../models/audit_log.model.js";
import { Coupon } from "../models/coupon.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAdminAction, memoryAuditLogs } from "../utils/auditLogger.js";
import { createTransactionalNotification } from "../utils/notificationService.js";
import { normalizeCouponCode } from "../services/coupon.service.js";

// Valid order lifecycle state transitions
const VALID_TRANSITIONS = {
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// In-memory offline store for products, categories, orders, and users when DB is not connected
export const memoryAdminStore = {
  products: [],
  categories: [],
  orders: [],
  users: [],
  coupons: [],
};

export const _resetMemoryAdminStore = () => {
  memoryAdminStore.products = [];
  memoryAdminStore.categories = [];
  memoryAdminStore.orders = [];
  memoryAdminStore.users = [];
  memoryAdminStore.coupons = [];
  memoryAuditLogs.length = 0;
};

// ==========================================
// 1. DASHBOARD METRICS
// ==========================================
export const getDashboardMetrics = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      revenueResult,
      statusBreakdown,
      lowStockCount,
      recentOrdersRaw,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments({ isActive: { $ne: false } }),
      Order.countDocuments(),
      Order.aggregate([
        {
          $match: {
            status: { $in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Product.countDocuments({
        stock: { $lte: 10 },
        isActive: { $ne: false },
      }),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("customer", "fullName email")
        .lean(),
    ]);

    const totalRevenue =
      revenueResult.length > 0 ? Math.round(revenueResult[0].totalRevenue * 100) / 100 : 0;

    const ordersByStatus = {
      PENDING_PAYMENT: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    for (const item of statusBreakdown) {
      if (ordersByStatus[item._id] !== undefined) {
        ordersByStatus[item._id] = item.count;
      }
    }

    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o._id,
      orderNumber: o.orderNumber,
      customerName: o.customer?.fullName || o.shippingAddress?.fullName || "Customer",
      customerEmail: o.customer?.email || "",
      totalAmount: o.totalAmount,
      status: o.status,
      itemsCount: o.orderItems?.length || 0,
      createdAt: o.createdAt,
    }));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue,
          ordersByStatus,
          lowStockProducts: lowStockCount,
          recentOrders,
        },
        "Dashboard metrics retrieved successfully"
      )
    );
  } else {
    // Offline / Mock in-memory calculation
    const totalUsers = memoryAdminStore.users.length;
    const totalProducts = memoryAdminStore.products.filter(
      (p) => p.isActive !== false
    ).length;
    const totalOrders = memoryAdminStore.orders.length;

    let totalRevenue = 0;
    const ordersByStatus = {
      PENDING_PAYMENT: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    for (const o of memoryAdminStore.orders) {
      if (["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(o.status)) {
        totalRevenue += o.totalAmount || 0;
      }
      if (ordersByStatus[o.status] !== undefined) {
        ordersByStatus[o.status]++;
      }
    }
    totalRevenue = Math.round(totalRevenue * 100) / 100;

    const lowStockProducts = memoryAdminStore.products.filter(
      (p) => p.stock <= 10 && p.isActive !== false
    ).length;

    const recentOrders = memoryAdminStore.orders.slice(0, 5).map((o) => ({
      id: o._id || o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName || "Customer",
      customerEmail: o.customerEmail || "",
      totalAmount: o.totalAmount,
      status: o.status,
      itemsCount: o.orderItems?.length || 0,
      createdAt: o.createdAt || new Date(),
    }));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue,
          ordersByStatus,
          lowStockProducts,
          recentOrders,
        },
        "Dashboard metrics retrieved successfully"
      )
    );
  }
});

// ==========================================
// 2. PRODUCT & INVENTORY MANAGEMENT
// ==========================================
export const getAdminProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    status = "all",
    lowStock,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  if (mongoose.connection.readyState === 1) {
    const filter = {};

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "inactive") {
      filter.isActive = false;
    }

    if (category && mongoose.Types.ObjectId.isValid(category.trim())) {
      filter.category = category.trim();
    }

    if (lowStock === "true" || lowStock === true) {
      filter.stock = { $lte: 10 };
    }

    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(sanitized, "i");
      filter.$or = [{ productName: regex }, { sellerName: regex }];
    }

    const [total, rawProducts] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("category", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const products = rawProducts.map((p) => ({
      id: p._id,
      _id: p._id,
      productName: p.productName,
      name: p.productName,
      sellerName: p.sellerName,
      description: p.description || "",
      price: p.price,
      stock: p.stock,
      isActive: p.isActive !== false,
      productRating: p.productRating || 0,
      productImage: p.productImage,
      category: p.category
        ? { id: p.category._id, name: p.category.name }
        : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          products,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Admin products retrieved successfully"
      )
    );
  } else {
    let filtered = [...memoryAdminStore.products];

    if (status === "active") {
      filtered = filtered.filter((p) => p.isActive !== false);
    } else if (status === "inactive") {
      filtered = filtered.filter((p) => p.isActive === false);
    }

    if (lowStock === "true" || lowStock === true) {
      filtered = filtered.filter((p) => p.stock <= 10);
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.productName.toLowerCase().includes(term) ||
          p.sellerName.toLowerCase().includes(term)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const products = filtered.slice(skip, skip + limitNum);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          products,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Admin products retrieved successfully"
      )
    );
  }
});

export const createAdminProduct = asyncHandler(async (req, res) => {
  const {
    productName,
    sellerName,
    description,
    price,
    stock,
    productImage,
    category,
  } = req.body;

  if (!productName || !productName.trim()) {
    throw new ApiError(400, "Product name is required");
  }
  if (!sellerName || !sellerName.trim()) {
    throw new ApiError(400, "Seller name is required");
  }
  if (price === undefined || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
    throw new ApiError(400, "Valid price is required (must be >= 0)");
  }
  if (!productImage || !productImage.trim()) {
    throw new ApiError(400, "Product image URL is required");
  }
  if (!category) {
    throw new ApiError(400, "Category ID is required");
  }

  let createdProduct = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(category)) {
      throw new ApiError(400, "Invalid category ID format");
    }

    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      throw new ApiError(404, "Selected category does not exist");
    }

    const product = await Product.create({
      productName: productName.trim(),
      sellerName: sellerName.trim(),
      description: description ? description.trim() : "",
      price: parseFloat(price),
      stock: stock !== undefined ? Math.max(0, parseInt(stock, 10)) : 0,
      productImage: productImage.trim(),
      category,
      productRating: 0,
      isActive: true,
    });

    createdProduct = await Product.findById(product._id)
      .populate("category", "name")
      .lean();
  } else {
    const id = new mongoose.Types.ObjectId().toString();
    createdProduct = {
      _id: id,
      id,
      productName: productName.trim(),
      sellerName: sellerName.trim(),
      description: description ? description.trim() : "",
      price: parseFloat(price),
      stock: stock !== undefined ? parseInt(stock, 10) : 0,
      productImage: productImage.trim(),
      category: { id: category, name: "General" },
      productRating: 0,
      isActive: true,
      createdAt: new Date(),
    };
    memoryAdminStore.products.unshift(createdProduct);
  }

  await logAdminAction({
    req,
    action: "PRODUCT_CREATED",
    resourceType: "PRODUCT",
    resourceId: createdProduct._id || createdProduct.id,
    details: {
      productName: createdProduct.productName,
      price: createdProduct.price,
      stock: createdProduct.stock,
    },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, createdProduct, "Product created successfully"));
});

export const updateAdminProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    productName,
    sellerName,
    description,
    price,
    stock,
    productImage,
    category,
    isActive,
  } = req.body;

  if (!id) {
    throw new ApiError(400, "Product ID is required");
  }

  let updated = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid product ID format");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    const previousValues = {
      productName: product.productName,
      price: product.price,
      stock: product.stock,
      isActive: product.isActive,
    };

    if (productName !== undefined) {
      if (!productName.trim()) throw new ApiError(400, "Product name cannot be empty");
      product.productName = productName.trim();
    }
    if (sellerName !== undefined) {
      if (!sellerName.trim()) throw new ApiError(400, "Seller name cannot be empty");
      product.sellerName = sellerName.trim();
    }
    if (description !== undefined) product.description = description.trim();
    if (price !== undefined) {
      const p = parseFloat(price);
      if (isNaN(p) || p < 0) throw new ApiError(400, "Price must be a valid number >= 0");
      product.price = p;
    }
    if (stock !== undefined) {
      const s = parseInt(stock, 10);
      if (isNaN(s) || s < 0) throw new ApiError(400, "Stock must be a valid number >= 0");
      product.stock = s;
    }
    if (productImage !== undefined) {
      if (!productImage.trim()) throw new ApiError(400, "Image URL cannot be empty");
      product.productImage = productImage.trim();
    }
    if (category !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        throw new ApiError(400, "Invalid category ID format");
      }
      const existingCategory = await Category.findById(category);
      if (!existingCategory) throw new ApiError(404, "Selected category not found");
      product.category = category;
    }
    if (isActive !== undefined) {
      product.isActive = Boolean(isActive);
    }

    await product.save();
    updated = await Product.findById(id).populate("category", "name").lean();

    await logAdminAction({
      req,
      action: "PRODUCT_UPDATED",
      resourceType: "PRODUCT",
      resourceId: id,
      details: { previousValues, updatedFields: req.body },
    });
  } else {
    const idx = memoryAdminStore.products.findIndex(
      (p) => (p._id || p.id).toString() === id.toString()
    );
    if (idx === -1) {
      throw new ApiError(404, "Product not found");
    }

    const current = memoryAdminStore.products[idx];
    const previousValues = { ...current };

    if (productName !== undefined) current.productName = productName.trim();
    if (sellerName !== undefined) current.sellerName = sellerName.trim();
    if (description !== undefined) current.description = description.trim();
    if (price !== undefined) current.price = parseFloat(price);
    if (stock !== undefined) current.stock = parseInt(stock, 10);
    if (productImage !== undefined) current.productImage = productImage.trim();
    if (isActive !== undefined) current.isActive = Boolean(isActive);

    updated = current;

    await logAdminAction({
      req,
      action: "PRODUCT_UPDATED",
      resourceType: "PRODUCT",
      resourceId: id,
      details: { previousValues, updatedFields: req.body },
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updated, "Product updated successfully"));
});

export const updateAdminStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity, operation = "SET" } = req.body;

  if (!id) throw new ApiError(400, "Product ID is required");
  if (quantity === undefined || isNaN(parseInt(quantity, 10))) {
    throw new ApiError(400, "Valid numeric quantity is required");
  }

  const q = parseInt(quantity, 10);
  let updatedProduct = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid product ID format");
    }

    const product = await Product.findById(id);
    if (!product) throw new ApiError(404, "Product not found");

    const previousStock = product.stock;
    let newStock = previousStock;

    if (operation === "SET") {
      if (q < 0) throw new ApiError(400, "Stock cannot be set to a negative number");
      newStock = q;
    } else if (operation === "ADD") {
      if (q <= 0) throw new ApiError(400, "Quantity to add must be greater than zero");
      newStock = previousStock + q;
    } else if (operation === "SUBTRACT") {
      if (q <= 0) throw new ApiError(400, "Quantity to subtract must be greater than zero");
      if (previousStock - q < 0) {
        throw new ApiError(400, `Cannot subtract ${q}: only ${previousStock} units available`);
      }
      newStock = previousStock - q;
    } else {
      throw new ApiError(400, "Invalid operation. Allowed: SET, ADD, SUBTRACT");
    }

    product.stock = newStock;
    await product.save();

    updatedProduct = await Product.findById(id).populate("category", "name").lean();

    await logAdminAction({
      req,
      action: "STOCK_UPDATED",
      resourceType: "PRODUCT",
      resourceId: id,
      details: { operation, quantity: q, previousStock, newStock },
    });
  } else {
    const idx = memoryAdminStore.products.findIndex(
      (p) => (p._id || p.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "Product not found");

    const product = memoryAdminStore.products[idx];
    const previousStock = product.stock || 0;
    let newStock = previousStock;

    if (operation === "SET") {
      if (q < 0) throw new ApiError(400, "Stock cannot be negative");
      newStock = q;
    } else if (operation === "ADD") {
      if (q <= 0) throw new ApiError(400, "Quantity must be > 0");
      newStock = previousStock + q;
    } else if (operation === "SUBTRACT") {
      if (q <= 0) throw new ApiError(400, "Quantity must be > 0");
      if (previousStock - q < 0) throw new ApiError(400, "Insufficient stock");
      newStock = previousStock - q;
    } else {
      throw new ApiError(400, "Invalid operation");
    }

    product.stock = newStock;
    updatedProduct = product;

    await logAdminAction({
      req,
      action: "STOCK_UPDATED",
      resourceType: "PRODUCT",
      resourceId: id,
      details: { operation, quantity: q, previousStock, newStock },
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedProduct, "Inventory updated successfully"));
});

export const deleteAdminProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Product ID is required");

  // Soft delete to protect past orders and references
  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid product ID format");
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!product) throw new ApiError(404, "Product not found");

    await logAdminAction({
      req,
      action: "PRODUCT_DELETED",
      resourceType: "PRODUCT",
      resourceId: id,
      details: { productName: product.productName, softDelete: true },
    });
  } else {
    const idx = memoryAdminStore.products.findIndex(
      (p) => (p._id || p.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "Product not found");

    memoryAdminStore.products[idx].isActive = false;

    await logAdminAction({
      req,
      action: "PRODUCT_DELETED",
      resourceType: "PRODUCT",
      resourceId: id,
      details: {
        productName: memoryAdminStore.products[idx].productName,
        softDelete: true,
      },
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { id, isActive: false }, "Product deactivated successfully"));
});

// ==========================================
// 3. CATEGORY MANAGEMENT
// ==========================================
export const getAdminCategories = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    const categories = await Category.find().sort({ name: 1 }).lean();

    // Compute product counts per category
    const productCounts = await Product.aggregate([
      { $match: { isActive: { $ne: false } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    for (const item of productCounts) {
      if (item._id) countMap[item._id.toString()] = item.count;
    }

    const formatted = categories.map((c) => ({
      id: c._id,
      _id: c._id,
      name: c.name,
      productCount: countMap[c._id.toString()] || 0,
      createdAt: c.createdAt,
    }));

    return res
      .status(200)
      .json(new ApiResponse(200, formatted, "Categories retrieved successfully"));
  } else {
    const formatted = memoryAdminStore.categories.map((c) => ({
      id: c._id || c.id,
      _id: c._id || c.id,
      name: c.name,
      productCount: memoryAdminStore.products.filter(
        (p) =>
          (p.category?._id || p.category?.id || p.category)?.toString() ===
          (c._id || c.id).toString()
      ).length,
      createdAt: c.createdAt || new Date(),
    }));

    return res
      .status(200)
      .json(new ApiResponse(200, formatted, "Categories retrieved successfully"));
  }
});

export const createAdminCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, "Category name is required");
  }

  const normalized = name.trim().toLowerCase();

  let created = null;

  if (mongoose.connection.readyState === 1) {
    const existing = await Category.findOne({ name: normalized });
    if (existing) {
      throw new ApiError(409, "Category with this name already exists");
    }

    created = await Category.create({ name: normalized });
  } else {
    const existing = memoryAdminStore.categories.find(
      (c) => c.name.toLowerCase() === normalized
    );
    if (existing) throw new ApiError(409, "Category already exists");

    const id = new mongoose.Types.ObjectId().toString();
    created = { _id: id, id, name: normalized, createdAt: new Date() };
    memoryAdminStore.categories.push(created);
  }

  await logAdminAction({
    req,
    action: "CATEGORY_CREATED",
    resourceType: "CATEGORY",
    resourceId: created._id || created.id,
    details: { name: normalized },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, created, "Category created successfully"));
});

export const updateAdminCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!id) throw new ApiError(400, "Category ID is required");
  if (!name || !name.trim()) throw new ApiError(400, "Category name cannot be empty");

  const normalized = name.trim().toLowerCase();
  let updated = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid category ID format");
    }

    const category = await Category.findById(id);
    if (!category) throw new ApiError(404, "Category not found");

    const previousName = category.name;
    category.name = normalized;
    await category.save();

    updated = category;

    await logAdminAction({
      req,
      action: "CATEGORY_UPDATED",
      resourceType: "CATEGORY",
      resourceId: id,
      details: { previousName, newName: normalized },
    });
  } else {
    const idx = memoryAdminStore.categories.findIndex(
      (c) => (c._id || c.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "Category not found");

    const previousName = memoryAdminStore.categories[idx].name;
    memoryAdminStore.categories[idx].name = normalized;
    updated = memoryAdminStore.categories[idx];

    await logAdminAction({
      req,
      action: "CATEGORY_UPDATED",
      resourceType: "CATEGORY",
      resourceId: id,
      details: { previousName, newName: normalized },
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updated, "Category updated successfully"));
});

export const deleteAdminCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Category ID is required");

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid category ID format");
    }

    // Check for referential integrity: do not leave orphaned products
    const productCount = await Product.countDocuments({
      category: id,
      isActive: { $ne: false },
    });
    if (productCount > 0) {
      throw new ApiError(
        400,
        `Cannot delete category: ${productCount} active products are currently assigned to it`
      );
    }

    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) throw new ApiError(404, "Category not found");

    await logAdminAction({
      req,
      action: "CATEGORY_DELETED",
      resourceType: "CATEGORY",
      resourceId: id,
      details: { name: deleted.name },
    });
  } else {
    const idx = memoryAdminStore.categories.findIndex(
      (c) => (c._id || c.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "Category not found");

    const activeProducts = memoryAdminStore.products.filter(
      (p) =>
        (p.category?._id || p.category?.id || p.category)?.toString() ===
          id.toString() && p.isActive !== false
    );
    if (activeProducts.length > 0) {
      throw new ApiError(
        400,
        `Cannot delete category: ${activeProducts.length} active products are currently assigned to it`
      );
    }

    const deleted = memoryAdminStore.categories.splice(idx, 1)[0];

    await logAdminAction({
      req,
      action: "CATEGORY_DELETED",
      resourceType: "CATEGORY",
      resourceId: id,
      details: { name: deleted.name },
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { id }, "Category deleted successfully"));
});

// ==========================================
// 4. ORDER MANAGEMENT
// ==========================================
export const getAdminOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  if (mongoose.connection.readyState === 1) {
    const filter = {};

    if (status && status.trim() && status !== "ALL") {
      filter.status = status.trim().toUpperCase();
    }

    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(sanitized, "i");
      filter.$or = [
        { orderNumber: regex },
        { "shippingAddress.fullName": regex },
      ];
    }

    const [total, rawOrders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .populate("customer", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const orders = rawOrders.map((o) => ({
      id: o._id,
      _id: o._id,
      orderNumber: o.orderNumber,
      customer: o.customer
        ? { id: o.customer._id, name: o.customer.fullName, email: o.customer.email }
        : null,
      shippingAddress: o.shippingAddress,
      orderItems: o.orderItems,
      subtotal: o.subtotal,
      shippingFee: o.shippingFee,
      tax: o.tax,
      totalAmount: o.totalAmount,
      status: o.status,
      carrier: o.carrier || "",
      trackingNumber: o.trackingNumber || "",
      createdAt: o.createdAt,
      statusHistory: o.statusHistory || [],
    }));

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          orders,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Admin orders retrieved successfully"
      )
    );
  } else {
    let filtered = [...memoryAdminStore.orders];

    if (status && status.trim() && status !== "ALL") {
      filtered = filtered.filter((o) => o.status === status.trim().toUpperCase());
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(term) ||
          o.customerName?.toLowerCase().includes(term)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const orders = filtered.slice(skip, skip + limitNum);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          orders,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Admin orders retrieved successfully"
      )
    );
  }
});

export const getAdminOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Order ID is required");

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid order ID format");
    }

    const order = await Order.findById(id)
      .populate("customer", "fullName email phone")
      .populate("payment")
      .lean();

    if (!order) throw new ApiError(404, "Order not found");

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: order._id,
          _id: order._id,
          orderNumber: order.orderNumber,
          customer: order.customer
            ? {
                id: order.customer._id,
                name: order.customer.fullName,
                email: order.customer.email,
                phone: order.customer.phone || "",
              }
            : null,
          shippingAddress: order.shippingAddress,
          orderItems: order.orderItems,
          subtotal: order.subtotal,
          shippingFee: order.shippingFee,
          tax: order.tax,
          totalAmount: order.totalAmount,
          status: order.status,
          carrier: order.carrier || "",
          trackingNumber: order.trackingNumber || "",
          cancellationReason: order.cancellationReason || "",
          payment: order.payment,
          statusHistory: order.statusHistory || [],
          createdAt: order.createdAt,
        },
        "Order retrieved successfully"
      )
    );
  } else {
    const order = memoryAdminStore.orders.find(
      (o) => (o._id || o.id).toString() === id.toString()
    );
    if (!order) throw new ApiError(404, "Order not found");

    return res
      .status(200)
      .json(new ApiResponse(200, order, "Order retrieved successfully"));
  }
});

export const updateAdminOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, carrier, trackingNumber, note } = req.body;

  if (!id) throw new ApiError(400, "Order ID is required");
  if (!status || !status.trim()) throw new ApiError(400, "Status is required");

  const newStatus = status.trim().toUpperCase();

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid order ID format");
    }

    const order = await Order.findById(id);
    if (!order) throw new ApiError(404, "Order not found");

    const currentStatus = order.status;

    // Validate state transition
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(
        400,
        `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed: ${
          allowed.length ? allowed.join(", ") : "None (terminal state)"
        }`
      );
    }

    order.status = newStatus;
    if (carrier) order.carrier = carrier.trim();
    if (trackingNumber) order.trackingNumber = trackingNumber.trim();

    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      note: note || `Status updated to ${newStatus} by admin`,
    });

    // If cancelled by admin, restore inventory and update payment
    if (newStatus === "CANCELLED") {
      order.cancelledAt = new Date();
      order.cancellationReason = note || "Cancelled by store administrator";

      for (const item of order.orderItems) {
        if (item.productId && item.quantity > 0) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity },
          });
        }
      }

      if (order.payment) {
        await Payment.findByIdAndUpdate(order.payment, {
          status: "REFUNDED",
        });
      }
    }

    await order.save();

    // Log admin action
    await logAdminAction({
      req,
      action: "ORDER_STATUS_UPDATED",
      resourceType: "ORDER",
      resourceId: id,
      details: { previousStatus: currentStatus, newStatus, carrier, trackingNumber },
    });

    // Trigger transactional in-app notification
    const notifTypeMap = {
      PROCESSING: "ORDER_PROCESSING",
      SHIPPED: "ORDER_SHIPPED",
      DELIVERED: "ORDER_DELIVERED",
      CANCELLED: "ORDER_CANCELLED",
    };

    if (notifTypeMap[newStatus]) {
      await createTransactionalNotification({
        userId: order.customer,
        type: notifTypeMap[newStatus],
        title: `Order ${newStatus.replace("_", " ")}`,
        body: `Your order #${order.orderNumber} has been updated to ${newStatus}.`,
        data: { orderId: order._id.toString(), orderNumber: order.orderNumber },
      });
    }

    return res
      .status(200)
      .json(new ApiResponse(200, order, `Order status updated to ${newStatus}`));
  } else {
    const idx = memoryAdminStore.orders.findIndex(
      (o) => (o._id || o.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "Order not found");

    const order = memoryAdminStore.orders[idx];
    const currentStatus = order.status;

    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(
        400,
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }

    order.status = newStatus;
    if (carrier) order.carrier = carrier;
    if (trackingNumber) order.trackingNumber = trackingNumber;

    await logAdminAction({
      req,
      action: "ORDER_STATUS_UPDATED",
      resourceType: "ORDER",
      resourceId: id,
      details: { previousStatus: currentStatus, newStatus },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, order, `Order status updated to ${newStatus}`));
  }
});

// ==========================================
// 5. USER MANAGEMENT
// ==========================================
export const getAdminUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  if (mongoose.connection.readyState === 1) {
    const filter = {};

    if (role && ["CUSTOMER", "ADMIN"].includes(role.trim().toUpperCase())) {
      filter.role = role.trim().toUpperCase();
    }

    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(sanitized, "i");
      filter.$or = [{ fullName: regex }, { email: regex }, { username: regex }];
    }

    const [total, rawUsers] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("-password -refreshToken")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const users = rawUsers.map((u) => ({
      id: u._id,
      _id: u._id,
      fullName: u.fullName,
      email: u.email,
      username: u.username,
      phone: u.phone || "",
      role: u.role,
      isActive: u.isActive !== false,
      createdAt: u.createdAt,
    }));

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          users,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Users retrieved successfully"
      )
    );
  } else {
    let filtered = [...memoryAdminStore.users];

    if (role) {
      filtered = filtered.filter((u) => u.role === role.toUpperCase());
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const users = filtered.slice(skip, skip + limitNum);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          users,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Users retrieved successfully"
      )
    );
  }
});

export const getAdminUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "User ID is required");

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid user ID format");
    }

    const user = await User.findById(id).select("-password -refreshToken").lean();
    if (!user) throw new ApiError(404, "User not found");

    const [orderCount, revenueResult] = await Promise.all([
      Order.countDocuments({ customer: id }),
      Order.aggregate([
        {
          $match: {
            customer: new mongoose.Types.ObjectId(id),
            status: { $in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    const totalSpent =
      revenueResult.length > 0 ? Math.round(revenueResult[0].total * 100) / 100 : 0;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: user._id,
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          username: user.username,
          phone: user.phone || "",
          role: user.role,
          isActive: user.isActive !== false,
          orderCount,
          totalSpent,
          createdAt: user.createdAt,
        },
        "User profile retrieved successfully"
      )
    );
  } else {
    const user = memoryAdminStore.users.find(
      (u) => (u._id || u.id).toString() === id.toString()
    );
    if (!user) throw new ApiError(404, "User not found");

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          ...user,
          orderCount: 0,
          totalSpent: 0,
        },
        "User profile retrieved successfully"
      )
    );
  }
});

export const updateAdminUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (!id) throw new ApiError(400, "User ID is required");
  if (isActive === undefined || typeof isActive !== "boolean") {
    throw new ApiError(400, "isActive boolean parameter is required");
  }

  // Self-protection: Admin cannot suspend their own account
  if (req.user && req.user._id.toString() === id.toString()) {
    throw new ApiError(400, "Bad Request: Administrator cannot modify their own status");
  }

  let updated = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid user ID format");
    }

    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found");

    const previousStatus = user.isActive !== false;
    user.isActive = isActive;
    await user.save();

    updated = {
      id: user._id,
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    await logAdminAction({
      req,
      action: "USER_STATUS_UPDATED",
      resourceType: "USER",
      resourceId: id,
      details: { previousStatus, newStatus: isActive },
    });
  } else {
    const idx = memoryAdminStore.users.findIndex(
      (u) => (u._id || u.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "User not found");

    const previousStatus = memoryAdminStore.users[idx].isActive !== false;
    memoryAdminStore.users[idx].isActive = isActive;
    updated = memoryAdminStore.users[idx];

    await logAdminAction({
      req,
      action: "USER_STATUS_UPDATED",
      resourceType: "USER",
      resourceId: id,
      details: { previousStatus, newStatus: isActive },
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updated,
        `User ${isActive ? "activated" : "suspended"} successfully`
      )
    );
});

export const updateAdminUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!id) throw new ApiError(400, "User ID is required");
  if (!role || !["CUSTOMER", "ADMIN"].includes(role.trim().toUpperCase())) {
    throw new ApiError(400, "Valid role is required (CUSTOMER or ADMIN)");
  }

  const targetRole = role.trim().toUpperCase();

  // Self-protection: Admin cannot modify their own role
  if (req.user && req.user._id.toString() === id.toString()) {
    throw new ApiError(400, "Bad Request: Administrator cannot modify their own role");
  }

  let updated = null;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid user ID format");
    }

    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found");

    const previousRole = user.role;
    user.role = targetRole;
    await user.save();

    updated = {
      id: user._id,
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
    };

    await logAdminAction({
      req,
      action: "USER_ROLE_UPDATED",
      resourceType: "USER",
      resourceId: id,
      details: { previousRole, newRole: targetRole },
    });
  } else {
    const idx = memoryAdminStore.users.findIndex(
      (u) => (u._id || u.id).toString() === id.toString()
    );
    if (idx === -1) throw new ApiError(404, "User not found");

    const previousRole = memoryAdminStore.users[idx].role;
    memoryAdminStore.users[idx].role = targetRole;
    updated = memoryAdminStore.users[idx];

    await logAdminAction({
      req,
      action: "USER_ROLE_UPDATED",
      resourceType: "USER",
      resourceId: id,
      details: { previousRole, newRole: targetRole },
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updated, `User role updated to ${targetRole}`));
});

// ==========================================
// 6. AUDIT LOGS
// ==========================================
export const getAdminAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, action, resourceType } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  if (mongoose.connection.readyState === 1) {
    const filter = {};
    if (action && action.trim()) filter.action = action.trim();
    if (resourceType && resourceType.trim()) {
      filter.resourceType = resourceType.trim().toUpperCase();
    }

    const [total, rawLogs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const logs = rawLogs.map((l) => ({
      id: l._id,
      _id: l._id,
      action: l.action,
      adminId: l.admin,
      adminEmail: l.adminEmail,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      details: l.details,
      createdAt: l.createdAt,
    }));

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          logs,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Audit logs retrieved successfully"
      )
    );
  } else {
    let filtered = [...memoryAuditLogs];
    if (action && action.trim()) {
      filtered = filtered.filter((l) => l.action === action.trim());
    }
    if (resourceType && resourceType.trim()) {
      filtered = filtered.filter(
        (l) => l.resourceType === resourceType.trim().toUpperCase()
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const logs = filtered.slice(skip, skip + limitNum);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          logs,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Audit logs retrieved successfully"
      )
    );
  }
});

// ==========================================
// 8. COUPON & PROMOTION MANAGEMENT
// ==========================================

export const getAdminCoupons = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, q, status } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  if (mongoose.connection.readyState === 1) {
    const filter = {};
    if (q && q.trim()) {
      filter.$or = [
        { code: { $regex: q.trim(), $options: "i" } },
        { name: { $regex: q.trim(), $options: "i" } },
      ];
    }
    if (status === "active") {
      filter.isActive = true;
      filter.expiresAt = { $gte: new Date() };
    } else if (status === "inactive") {
      filter.isActive = false;
    } else if (status === "expired") {
      filter.expiresAt = { $lt: new Date() };
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Coupon.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          coupons,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Coupons retrieved successfully"
      )
    );
  } else {
    let filtered = [...memoryAdminStore.coupons];
    if (q && q.trim()) {
      const qLower = q.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.code.toLowerCase().includes(qLower) ||
          c.name.toLowerCase().includes(qLower)
      );
    }
    if (status === "active") {
      filtered = filtered.filter((c) => c.isActive && new Date(c.expiresAt) >= new Date());
    } else if (status === "inactive") {
      filtered = filtered.filter((c) => !c.isActive);
    } else if (status === "expired") {
      filtered = filtered.filter((c) => new Date(c.expiresAt) < new Date());
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const coupons = filtered.slice(skip, skip + limitNum);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          coupons,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
        "Coupons retrieved successfully"
      )
    );
  }
});

export const createAdminCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    name,
    description,
    discountType,
    discountValue,
    minimumOrderValue = 0,
    maximumDiscountAmount = null,
    startAt,
    expiresAt,
    isActive = true,
    usageLimit = null,
    perUserLimit = 1,
    applicableProducts = [],
    applicableCategories = [],
    excludedProducts = [],
    excludedCategories = [],
    firstOrderOnly = false,
  } = req.body;

  if (!code || !name || !discountType || discountValue === undefined || !expiresAt) {
    throw new ApiError(
      400,
      "Code, name, discountType, discountValue, and expiresAt are required"
    );
  }

  if (!["PERCENTAGE", "FIXED"].includes(discountType)) {
    throw new ApiError(400, "Discount type must be PERCENTAGE or FIXED");
  }

  const numVal = Number(discountValue);
  if (isNaN(numVal) || numVal < 0) {
    throw new ApiError(400, "Discount value must be a positive number");
  }

  if (discountType === "PERCENTAGE" && numVal > 100) {
    throw new ApiError(400, "Percentage discount value cannot exceed 100%");
  }

  const normalizedCode = normalizeCouponCode(code);

  if (mongoose.connection.readyState === 1) {
    const existing = await Coupon.findOne({ code: normalizedCode });
    if (existing) {
      throw new ApiError(409, `Coupon with code "${normalizedCode}" already exists`);
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      name: name.trim(),
      description: description ? description.trim() : "",
      discountType,
      discountValue: numVal,
      minimumOrderValue: Number(minimumOrderValue) || 0,
      maximumDiscountAmount: maximumDiscountAmount !== null && maximumDiscountAmount !== undefined ? Number(maximumDiscountAmount) : null,
      startAt: startAt ? new Date(startAt) : new Date(),
      expiresAt: new Date(expiresAt),
      isActive: Boolean(isActive),
      usageLimit: usageLimit !== null && usageLimit !== undefined ? Number(usageLimit) : null,
      perUserLimit: Number(perUserLimit) || 1,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      excludedCategories,
      firstOrderOnly: Boolean(firstOrderOnly),
    });

    await logAdminAction(
      req.user._id,
      "COUPON_CREATED",
      "COUPON",
      coupon._id,
      { code: normalizedCode, discountType, discountValue: numVal }
    );

    return res
      .status(201)
      .json(new ApiResponse(201, coupon, "Coupon created successfully"));
  } else {
    const exists = memoryAdminStore.coupons.some((c) => c.code === normalizedCode);
    if (exists) {
      throw new ApiError(409, `Coupon with code "${normalizedCode}" already exists`);
    }

    const mockCoupon = {
      _id: `coup_${Date.now()}`,
      code: normalizedCode,
      name: name.trim(),
      description: description ? description.trim() : "",
      discountType,
      discountValue: numVal,
      minimumOrderValue: Number(minimumOrderValue) || 0,
      maximumDiscountAmount: maximumDiscountAmount !== null && maximumDiscountAmount !== undefined ? Number(maximumDiscountAmount) : null,
      startAt: startAt ? new Date(startAt) : new Date(),
      expiresAt: new Date(expiresAt),
      isActive: Boolean(isActive),
      usageLimit: usageLimit !== null && usageLimit !== undefined ? Number(usageLimit) : null,
      usedCount: 0,
      perUserLimit: Number(perUserLimit) || 1,
      firstOrderOnly: Boolean(firstOrderOnly),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryAdminStore.coupons.unshift(mockCoupon);

    return res
      .status(201)
      .json(new ApiResponse(201, mockCoupon, "Coupon created successfully"));
  }
});

export const getAdminCouponById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    const coupon = await Coupon.findById(id)
      .populate("applicableProducts", "productName price")
      .populate("applicableCategories", "name slug")
      .lean();
    if (!coupon) {
      throw new ApiError(404, "Coupon not found");
    }
    return res.status(200).json(new ApiResponse(200, coupon, "Coupon retrieved"));
  } else {
    const coupon = memoryAdminStore.coupons.find(
      (c) => c._id.toString() === id || c.code === id
    );
    if (!coupon) {
      throw new ApiError(404, "Coupon not found");
    }
    return res.status(200).json(new ApiResponse(200, coupon, "Coupon retrieved"));
  }
});

export const updateAdminCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.code; // Prevent code modification
  delete updates.usedCount; // Prevent tampering with usage count

  if (updates.discountType && !["PERCENTAGE", "FIXED"].includes(updates.discountType)) {
    throw new ApiError(400, "Discount type must be PERCENTAGE or FIXED");
  }
  if (updates.discountValue !== undefined) {
    const val = Number(updates.discountValue);
    if (isNaN(val) || val < 0) {
      throw new ApiError(400, "Discount value must be a positive number");
    }
    if (updates.discountType === "PERCENTAGE" && val > 100) {
      throw new ApiError(400, "Percentage discount value cannot exceed 100%");
    }
    updates.discountValue = val;
  }

  if (mongoose.connection.readyState === 1) {
    const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
    if (!coupon) {
      throw new ApiError(404, "Coupon not found");
    }

    await logAdminAction(req.user._id, "COUPON_UPDATED", "COUPON", id, updates);

    return res.status(200).json(new ApiResponse(200, coupon, "Coupon updated successfully"));
  } else {
    const idx = memoryAdminStore.coupons.findIndex((c) => c._id.toString() === id);
    if (idx === -1) {
      throw new ApiError(404, "Coupon not found");
    }
    const updated = { ...memoryAdminStore.coupons[idx], ...updates, updatedAt: new Date() };
    memoryAdminStore.coupons[idx] = updated;

    return res.status(200).json(new ApiResponse(200, updated, "Coupon updated successfully"));
  }
});

export const toggleAdminCouponStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      throw new ApiError(404, "Coupon not found");
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    await logAdminAction(
      req.user._id,
      "COUPON_STATUS_CHANGED",
      "COUPON",
      id,
      { isActive: coupon.isActive }
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          coupon,
          `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`
        )
      );
  } else {
    const idx = memoryAdminStore.coupons.findIndex((c) => c._id.toString() === id);
    if (idx === -1) {
      throw new ApiError(404, "Coupon not found");
    }
    memoryAdminStore.coupons[idx].isActive = !memoryAdminStore.coupons[idx].isActive;
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          memoryAdminStore.coupons[idx],
          `Coupon status updated`
        )
      );
  }
});

export const deleteAdminCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    const coupon = await Coupon.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!coupon) {
      throw new ApiError(404, "Coupon not found");
    }

    await logAdminAction(req.user._id, "COUPON_DELETED", "COUPON", id);

    return res.status(200).json(new ApiResponse(200, coupon, "Coupon deactivated successfully"));
  } else {
    const idx = memoryAdminStore.coupons.findIndex((c) => c._id.toString() === id);
    if (idx === -1) {
      throw new ApiError(404, "Coupon not found");
    }
    memoryAdminStore.coupons[idx].isActive = false;
    return res.status(200).json(new ApiResponse(200, memoryAdminStore.coupons[idx], "Coupon deactivated successfully"));
  }
});
