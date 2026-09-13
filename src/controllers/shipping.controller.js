import { ShippingService } from "../services/shipping.service.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Public: Check serviceability for an Indian PIN code
 * GET /api/v1/shipping/serviceability/:pinCode
 */
export const getServiceability = asyncHandler(async (req, res) => {
  const { pinCode } = req.params;

  const result = await ShippingService.checkServiceability(pinCode);

  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      result.serviceable
        ? "PIN code is serviceable for delivery"
        : (result.message || "PIN code is currently not serviceable")
    )
  );
});

/**
 * Public: Calculate authoritative shipping quote for cart/checkout
 * POST /api/v1/shipping/quote
 * Body: { pinCode, subtotal, shippingMethod }
 */
export const getShippingQuote = asyncHandler(async (req, res) => {
  const { pinCode, subtotal = 0, shippingMethod = "STANDARD" } = req.body;

  if (!pinCode) {
    throw new ApiError(400, "PIN code is required to calculate shipping quote");
  }

  const quote = await ShippingService.calculateShippingQuote({
    pinCode,
    subtotal: Number(subtotal) || 0,
    shippingMethod,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      quote,
      quote.serviceable
        ? "Shipping quote calculated successfully"
        : "PIN code is not serviceable"
    )
  );
});

/**
 * Public: Get standard available shipping methods
 * GET /api/v1/shipping/methods
 */
export const getAvailableShippingMethods = asyncHandler(async (req, res) => {
  const config = await ShippingService.getShippingConfig();

  const methods = [
    {
      code: "STANDARD",
      name: "Standard Delivery",
      minDays: config.standardDeliveryMinDays,
      maxDays: config.standardDeliveryMaxDays,
      baseCharge: config.defaultShippingFee,
      freeShippingThreshold: config.freeShippingThreshold,
      isActive: true,
    },
    {
      code: "EXPRESS",
      name: "Express Delivery",
      minDays: config.expressDeliveryMinDays,
      maxDays: config.expressDeliveryMaxDays,
      baseCharge: config.expressShippingFee,
      freeShippingThreshold: null,
      isActive: true,
    },
  ];

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        methods,
        freeShippingThreshold: config.freeShippingThreshold,
        currency: "INR",
        currencySymbol: "₹",
      },
      "Available shipping methods retrieved successfully"
    )
  );
});

/**
 * Admin: List postal codes with pagination & filters
 * GET /api/v1/admin/shipping/postal-codes
 */
export const getAdminPostalCodes = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || "";
  const isServiceable = req.query.isServiceable || "all";
  const zone = req.query.zone || "all";

  const result = await ShippingService.listPostalCodes({
    page,
    limit,
    search,
    isServiceable,
    zone,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      "Postal codes retrieved successfully"
    )
  );
});

/**
 * Admin: Create or update postal code serviceability
 * POST /api/v1/admin/shipping/postal-codes
 */
export const upsertAdminPostalCode = asyncHandler(async (req, res) => {
  const { pinCode, city, state } = req.body;

  if (!pinCode || !city || !state) {
    throw new ApiError(400, "PIN code, city, and state are required");
  }

  const result = await ShippingService.upsertPostalCode(req.body);

  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      "Postal code serviceability updated successfully"
    )
  );
});

/**
 * Admin: Delete postal code serviceability
 * DELETE /api/v1/admin/shipping/postal-codes/:id
 */
export const deleteAdminPostalCode = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await ShippingService.deletePostalCode(id);
  if (!deleted) {
    throw new ApiError(404, "Postal code record not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      deleted,
      "Postal code record removed successfully"
    )
  );
});
