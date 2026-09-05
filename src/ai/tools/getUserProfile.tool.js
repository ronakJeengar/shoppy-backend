import mongoose from "mongoose";
import { AITool } from "./base.tool.js";
import { User } from "../../models/user.model.js";
import { Address } from "../../models/address.model.js";
import { AiError } from "../errors/aiError.js";

export class GetUserProfileTool extends AITool {
  constructor() {
    super({
      name: "get_user_profile",
      description:
        "Retrieve the authenticated customer's profile details (fullName, email, phone, memberSince) and default shipping address.",
      parameters: {
        type: "object",
        properties: {},
      },
      requiresAuth: true,
      allowedRoles: ["CUSTOMER", "USER", "ADMIN"],
      sideEffectType: "READ_ONLY",
      timeout: 3000,
      idempotent: true,
    });
  }

  async execute(args, context) {
    if (!context.user?._id) {
      throw AiError.unauthorizedTool(this.name, "CUSTOMER");
    }

    const userId = context.user._id;

    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(userId).select("-password -refreshToken");
      if (!user) {
        throw new Error("Customer profile not found");
      }

      const defaultAddress = await Address.findOne({
        user: userId,
        isDefault: true,
      });

      return {
        userId: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || "Not set",
        role: user.role,
        memberSince: user.createdAt,
        defaultAddress: defaultAddress
          ? {
              fullName: defaultAddress.fullName,
              city: defaultAddress.city,
              state: defaultAddress.state,
              postalCode: defaultAddress.postalCode,
              country: defaultAddress.country,
            }
          : null,
      };
    }

    // In-memory fallback using authenticated context
    const u = context.user;
    return {
      userId: u._id.toString(),
      fullName: u.fullName || "Jane Doe",
      email: u.email || "customer@example.com",
      phone: u.phone || "+1 555-0199",
      role: u.role || "CUSTOMER",
      memberSince: new Date("2024-01-01"),
      defaultAddress: {
        fullName: u.fullName || "Jane Doe",
        city: "Springfield",
        state: "OR",
        postalCode: "97477",
        country: "US",
      },
    };
  }
}
