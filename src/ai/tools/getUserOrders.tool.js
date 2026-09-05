import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Order } from "../../models/order.model.js";
import { inMemoryOrders } from "../../controllers/order.controller.js";
import { memoryAdminStore } from "../../controllers/admin.controller.js";
import { AiError } from "../errors/aiError.js";

export class GetUserOrdersTool extends AITool {
  constructor() {
    super({
      name: "get_user_orders",
      description:
        "Retrieve recent purchase orders placed by the authenticated customer, showing status, items count, and total.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Maximum number of recent orders to return (default 5, max 10)",
          },
          status: {
            type: "string",
            description: "Optional order status filter (e.g. 'CONFIRMED', 'SHIPPED', 'DELIVERED')",
          },
        },
      },
      requiresAuth: true,
      allowedRoles: ["CUSTOMER", "USER", "ADMIN"],
    });
  }

  async execute({ limit = 5, status } = {}, context = {}) {
    if (!context?.user?._id) {
      throw AiError.unauthorizedTool(this.name, "CUSTOMER, USER");
    }

    const userId = context.user._id.toString();
    const maxResults = Math.min(10, Math.max(1, parseInt(limit, 10) || 5));

    if (mongoose.connection.readyState === 1) {
      const filter = { customer: new mongoose.Types.ObjectId(userId) };
      if (status && status.trim()) {
        filter.status = status.trim().toUpperCase();
      }

      const orders = await Order.find(filter)
        .sort({ createdAt: -1 })
        .limit(maxResults)
        .select("orderNumber status totalAmount currency orderItems createdAt carrier trackingNumber")
        .lean();

      return {
        count: orders.length,
        orders: orders.map((o) => ({
          id: o._id.toString(),
          orderNumber: o.orderNumber,
          status: o.status,
          totalAmount: o.totalAmount,
          currency: o.currency || "USD",
          itemCount: o.orderItems?.length || 0,
          carrier: o.carrier || "Standard Courier",
          trackingNumber: o.trackingNumber || "Pending shipment",
          createdAt: o.createdAt,
        })),
      };
    } else {
      // In-memory test store fallback: combine inMemoryOrders and memoryAdminStore.orders
      const combined = [
        ...Array.from(inMemoryOrders.values()),
        ...(memoryAdminStore.orders || []),
      ];

      const userOrders = combined.filter((o) => {
        const custId = (o.customer?._id || o.customer?.id || o.customer)?.toString();
        const matchesUser = custId === userId;
        const matchesStatus = !status || o.status?.toUpperCase() === status.trim().toUpperCase();
        return matchesUser && matchesStatus;
      });

      // Deduplicate by orderNumber or id
      const seen = new Set();
      const uniqueOrders = [];
      for (const o of userOrders) {
        const key = o.orderNumber || (o._id || o.id)?.toString();
        if (!seen.has(key)) {
          seen.add(key);
          uniqueOrders.push(o);
        }
      }

      const sliced = uniqueOrders.slice(0, maxResults);
      return {
        count: sliced.length,
        orders: sliced.map((o) => ({
          id: (o._id || o.id || "ord_mock").toString(),
          orderNumber: o.orderNumber || "ORD-TEST-001",
          status: o.status || "CONFIRMED",
          totalAmount: o.totalAmount || 0,
          currency: o.currency || "USD",
          itemCount: o.orderItems?.length || 0,
          carrier: o.carrier || "Standard Courier",
          trackingNumber: o.trackingNumber || "Pending shipment",
          createdAt: o.createdAt || new Date(),
        })),
      };
    }
  }
}
