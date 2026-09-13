import mongoose from "mongoose";
import { Order } from "../models/order.model.js";
import { InvoiceService } from "../services/invoice.service.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { inMemoryOrders } from "./order.controller.js";

/**
 * GET /api/v1/orders/:id/invoice
 * Retrieve or issue the GST tax invoice for an order with strict IDOR protection.
 */
export const getOrderInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid order ID format");
    }

    const order = await Order.findById(id);
    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    // IDOR Enforcement: Only order owner or admin can access invoice
    if (
      req.user.role !== "ADMIN" &&
      order.customer.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "Access denied: You cannot view invoices for other customers' orders");
    }

    const invoice = await InvoiceService.issueOrGetInvoice(id);
    return res
      .status(200)
      .json(new ApiResponse(200, invoice, "Tax invoice retrieved successfully"));
  }

  // Offline / Test Fallback
  const cachedOrder = inMemoryOrders.get(id);
  if (!cachedOrder) {
    throw new ApiError(404, "Order not found");
  }

  if (
    req.user.role !== "ADMIN" &&
    cachedOrder.customer.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Access denied: You cannot view invoices for other customers' orders");
  }

  const invoice = await InvoiceService.issueOrGetInvoice(id);
  return res
    .status(200)
    .json(new ApiResponse(200, invoice, "Tax invoice retrieved successfully"));
});

/**
 * GET /api/v1/orders/:id/invoice/html
 * Printable, browser/mobile friendly HTML invoice document.
 */
export const getOrderInvoiceHtml = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid order ID format");
    }

    const order = await Order.findById(id);
    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    // IDOR Enforcement
    if (
      req.user.role !== "ADMIN" &&
      order.customer.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "Access denied: You cannot view invoices for other customers' orders");
    }

    const invoice = await InvoiceService.issueOrGetInvoice(id);
    const html = InvoiceService.generateInvoiceHtml(invoice);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  }

  // Offline / Test Fallback
  const cachedOrder = inMemoryOrders.get(id);
  if (!cachedOrder) {
    throw new ApiError(404, "Order not found");
  }

  if (
    req.user.role !== "ADMIN" &&
    cachedOrder.customer.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Access denied: You cannot view invoices for other customers' orders");
  }

  const invoice = await InvoiceService.issueOrGetInvoice(id);
  const html = InvoiceService.generateInvoiceHtml(invoice);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
});

/**
 * GET /api/v1/admin/invoices
 * Admin endpoint to list all invoices with pagination and search.
 */
export const getAdminInvoices = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  if (mongoose.connection.readyState === 1) {
    const filter = { invoiceStatus: { $in: ["ISSUED", "CANCELLED"] } };
    if (req.query.search) {
      const q = req.query.search.trim();
      filter.$or = [
        { invoiceNumber: { $regex: q, $options: "i" } },
        { orderNumber: { $regex: q, $options: "i" } },
      ];
    }

    const totalInvoices = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("invoiceNumber invoiceDate invoiceStatus orderNumber totalAmount customer status currency createdAt");

    const totalPages = Math.ceil(totalInvoices / limit) || 1;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          invoices: orders.map((o) => ({
            id: o._id,
            invoiceNumber: o.invoiceNumber,
            invoiceDate: o.invoiceDate,
            invoiceStatus: o.invoiceStatus,
            orderNumber: o.orderNumber,
            totalAmount: o.totalAmount,
            currency: o.currency,
            orderStatus: o.status,
            createdAt: o.createdAt,
          })),
          page,
          limit,
          totalInvoices,
          totalPages,
        },
        "Admin invoices retrieved successfully"
      )
    );
  }

  // Offline / Test Fallback
  const allOrders = Array.from(inMemoryOrders.values()).filter(
    (o) => o.invoiceNumber
  );
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        invoices: allOrders.slice(skip, skip + limit),
        page,
        limit,
        totalInvoices: allOrders.length,
        totalPages: Math.ceil(allOrders.length / limit) || 1,
      },
      "Admin invoices retrieved successfully"
    )
  );
});
