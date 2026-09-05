import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { Order } from "../../models/order.model.js";
import { memoryAdminStore } from "../../controllers/admin.controller.js";
import { AiError } from "../errors/aiError.js";

export class GetUserOrderStatusTool extends AITool {
  constructor() {
    super({
      name: "get_user_order_status",
      description:
        "Look up the current tracking and delivery status of an order belonging to the authenticated customer.",
      parameters: {
        type: "object",
        properties: {
          orderId: {
            type: "string",
            description: "The order number or order identifier (e.g. ORD-12345 or ObjectId)",
          },
        },
        required: ["orderId"],
      },
      requiresAuth: true,
      allowedRoles: ["CUSTOMER", "ADMIN"],
    });
  }

  async execute({ orderId, orderIdentifier } = {}, context) {
    if (!context?.user?._id) {
      throw AiError.unauthorizedTool(this.name, "CUSTOMER, ADMIN");
    }

    const userId = context.user._id.toString();
    const queryTerm = String(orderId || orderIdentifier || "").trim();

    if (mongoose.connection.readyState === 1) {
      const filter = { customer: new mongoose.Types.ObjectId(userId) };

      if (mongoose.Types.ObjectId.isValid(queryTerm)) {
        filter.$or = [{ _id: new mongoose.Types.ObjectId(queryTerm) }, { orderNumber: queryTerm }];
      } else {
        filter.orderNumber = queryTerm;
      }

      const order = await Order.findOne(filter).lean();
      if (!order) {
        return {
          found: false,
          message: "Order not found or does not belong to your account.",
        };
      }

      return {
        found: true,
        orderNumber: order.orderNumber,
        status: order.status,
        itemCount: order.orderItems?.length || 0,
        carrier: order.carrier || "Standard Courier",
        trackingNumber: order.trackingNumber || "Pending shipment",
        createdAt: order.createdAt,
        totalAmount: order.totalAmount,
      };
    } else {
      // In-memory test store fallback
      const order = memoryAdminStore.orders.find((o) => {
        const custId = (o.customer?._id || o.customer?.id || o.customer)?.toString();
        const matchesUser = custId === userId;
        const matchesId =
          (o._id || o.id)?.toString() === queryTerm ||
          o.orderNumber?.toLowerCase() === queryTerm.toLowerCase();
        return matchesUser && matchesId;
      });

      if (!order) {
        return {
          found: false,
          message: "Order not found or does not belong to your account.",
        };
      }

      return {
        found: true,
        orderNumber: order.orderNumber,
        status: order.status,
        itemCount: order.orderItems?.length || 0,
        carrier: order.carrier || "Standard Courier",
        trackingNumber: order.trackingNumber || "Pending shipment",
        createdAt: order.createdAt,
        totalAmount: order.totalAmount,
      };
    }
  }
}
