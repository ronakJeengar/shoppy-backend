import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { CodService } from "../services/cod.service.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * GET /api/v1/admin/cod/config
 * Retrieve current authoritative Cash on Delivery configuration
 */
export const getAdminCodConfig = asyncHandler(async (req, res) => {
  const config = await CodService.getCodConfig();
  return res
    .status(200)
    .json(new ApiResponse(200, config, "COD configuration retrieved successfully"));
});

/**
 * PATCH /api/v1/admin/cod/config
 * Update Cash on Delivery rules, fees, and thresholds
 */
export const updateAdminCodConfig = asyncHandler(async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
    throw new ApiError(400, "At least one configuration field must be provided for update");
  }

  // Basic validation on numeric fields if provided
  if (updates.minOrderValue !== undefined && Number(updates.minOrderValue) < 0) {
    throw new ApiError(400, "Minimum order value cannot be negative");
  }
  if (updates.maxOrderValue !== undefined && Number(updates.maxOrderValue) < 0) {
    throw new ApiError(400, "Maximum order value cannot be negative");
  }
  if (
    updates.minOrderValue !== undefined &&
    updates.maxOrderValue !== undefined &&
    Number(updates.minOrderValue) > Number(updates.maxOrderValue)
  ) {
    throw new ApiError(400, "Minimum order value cannot exceed maximum order value");
  }
  if (updates.fee !== undefined && Number(updates.fee) < 0) {
    throw new ApiError(400, "COD fee cannot be negative");
  }

  const updatedConfig = await CodService.updateCodConfig(updates);
  return res
    .status(200)
    .json(new ApiResponse(200, updatedConfig, "COD configuration updated successfully"));
});

/**
 * PATCH /api/v1/admin/users/:id/cod-block
 * Toggle or set customer COD blocked status
 */
export const updateUserCodBlockStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isCodBlocked } = req.body;

  if (typeof isCodBlocked !== "boolean") {
    throw new ApiError(400, "Field 'isCodBlocked' must be a boolean");
  }

  if (mongoose.connection.readyState === 1) {
    const user = await User.findByIdAndUpdate(
      id,
      { isCodBlocked },
      { new: true }
    ).select("-password");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { userId: user._id, isCodBlocked: user.isCodBlocked },
        `User COD status updated to ${isCodBlocked ? "BLOCKED" : "UNBLOCKED"}`
      )
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { userId: id, isCodBlocked },
      `User COD status updated to ${isCodBlocked ? "BLOCKED" : "UNBLOCKED"}`
    )
  );
});
