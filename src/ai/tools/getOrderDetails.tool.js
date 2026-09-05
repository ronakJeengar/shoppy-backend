import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Order } from "../../models/order.model.js";
import { inMemoryOrders } from "../../controllers/order.controller.js";
import { memoryAdminStore } from "../../controllers/admin.controller.js";
import { AiError } from "../errors/aiError.js";

export class GetOrderDetailsTool extends AITool {
  constructor() {
    super({
      name: "get_order_details",
      description:
        "Retrieve comprehensive details, items, delivery address, and tracking info for a specific customer order.",
      parameters: {
        type: "object",
        properties: {
          orderId: {
            type: "string",
            description: "The order ID or order number (e.g. 'ORD-2026-X99')",
          },
        },
        required: ["orderId"],
      },
      requiresAuth: true,
      allowedRoles: ["CUSTOMER", "USER", "ADMIN"],
    });
  }

  async execute({ orderId } = {}, context = {}) {
    if (!context?.user?._id) {
      throw AiError.unauthorizedTool(this.name, "CUSTOMER, USER");
    }

    if (!orderId) {
      return { found: false, error: "orderId parameter is required" };
    }

    const userId = context.user._id.toString();
    const isAdmin = context.user.role === "ADMIN";
    const queryTerm = String(orderId).trim();

    if (mongoose.connection.readyState === 1) {
      const filter = {};
      if (!isAdmin) {
        filter.customer = new mongoose.Types.ObjectId(userId);
      }

      if (mongoose.Types.ObjectId.isValid(queryTerm)) {
        filter.$or = [
          { _id: new mongoose.Types.ObjectId(queryTerm) },
          { orderNumber: queryTerm },
        ];
      } else {
        filter.orderNumber = queryTerm;
      }

      const order = await Order.findOne(filter)
        .populate("payment", "status paymentMethod transactionId amount currency")
        .lean();

      if (!order) {
        return {
          found: false,
          error: "Order not found or unauthorized.",
        };
      }

      return {
        found: true,
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        items: (order.orderItems || []).map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          productImage: item.productImage || "",
        })),
        shippingAddress: order.shippingAddress
          ? `${order.shippingAddress.streetAddress || ""}, ${order.shippingAddress.city || ""}, ${order.shippingAddress.state || ""} ${order.shippingAddress.postalCode || ""}`.trim()
          : "Not available",
        carrier: order.carrier || "Standard Courier",
        trackingNumber: order.trackingNumber || "Pending shipment",
        totalAmount: order.totalAmount,
        currency: order.currency || "USD",
        paymentStatus: order.payment?.status || "CONFIRMED",
        createdAt: order.createdAt,
      };
    } else {
      // In-memory test store fallback
      const combined = [
        ...Array.from(inMemoryOrders.values()),
        ...(memoryAdminStore.orders || []),
      ];

      const order = combined.find((o) => {
        const matchesId =
          (o._id || o.id)?.toString() === queryTerm ||
          o.orderNumber?.toLowerCase() === queryTerm.toLowerCase();
        return matchesId;
      });

      if (!order) {
        return {
          found: false,
          error: "Order not found or unauthorized.",
        };
      }

      // IDOR Verification
      const custId = (order.customer?._id || order.customer?.id || order.customer)?.toString();
      if (!isAdmin && custId !== userId) {
        return {
          found: false,
          error: "Order not found or unauthorized.",
        };
      }

      return {
        found: true,
        orderId: (order._id || order.id || "ord_mock").toString(),
        orderNumber: order.orderNumber || "ORD-TEST-001",
        status: order.status || "CONFIRMED",
        items: (order.orderItems || []).map((item) => ({
          productName: item.productName || "Product",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || item.price || 0,
          lineTotal: item.lineTotal || (item.quantity || 1) * (item.unitPrice || 0),
          productImage: item.productImage || "",
        })),
        shippingAddress: order.shippingAddress
          ? `${order.shippingAddress.streetAddress || ""}, ${order.shippingAddress.city || ""}, ${order.shippingAddress.state || ""} ${order.shippingAddress.postalCode || ""}`.trim()
          : "Standard Shipping Address",
        carrier: order.carrier || "Standard Courier",
        trackingNumber: order.trackingNumber || "Pending shipment",
        totalAmount: order.totalAmount || 0,
        currency: order.currency || "USD",
        paymentStatus: order.payment?.status || "CONFIRMED",
        createdAt: order.createdAt || new Date(),
      };
    }
  }
}
