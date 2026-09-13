import { FlashSaleService } from "../services/flashSale.service.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Public: Get active flash sales with clock-skew compensation serverTime
 */
export const getActiveFlashSales = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  const result = await FlashSaleService.getActiveFlashSales({
    now: new Date(),
    limit,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      "Active flash sales retrieved successfully"
    )
  );
});

/**
 * Public: Get upcoming flash sales
 */
export const getUpcomingFlashSales = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  const result = await FlashSaleService.getUpcomingFlashSales({
    now: new Date(),
    limit,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      "Upcoming flash sales retrieved successfully"
    )
  );
});

/**
 * Public: Get single flash sale by ID
 */
export const getFlashSaleById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sale = await FlashSaleService.getFlashSaleById(id);

  return res.status(200).json(
    new ApiResponse(
      200,
      sale,
      "Flash sale details retrieved successfully"
    )
  );
});

/**
 * Public: Check if a specific product is currently part of an active flash sale
 */
export const getProductFlashSale = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const flashSale = await FlashSaleService.getActiveProductFlashSale(productId);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isFlashSale: Boolean(flashSale),
        flashSale,
        serverTime: new Date().toISOString(),
      },
      flashSale ? "Active flash sale found for product" : "Product is not on flash sale"
    )
  );
});

/**
 * Admin: List all flash sales with pagination and status filtering
 */
export const getAdminFlashSales = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const status = req.query.status || "all";
  const search = req.query.search;

  const result = await FlashSaleService.listFlashSales({
    page,
    limit,
    status,
    search,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      "Admin flash sales retrieved successfully"
    )
  );
});

/**
 * Admin: Create a new flash sale
 */
export const createAdminFlashSale = asyncHandler(async (req, res) => {
  const created = await FlashSaleService.createFlashSale(req.body);

  return res.status(201).json(
    new ApiResponse(
      201,
      created,
      "Flash sale created successfully"
    )
  );
});

/**
 * Admin: Get flash sale by ID
 */
export const getAdminFlashSaleById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sale = await FlashSaleService.getFlashSaleById(id);

  return res.status(200).json(
    new ApiResponse(
      200,
      sale,
      "Flash sale details retrieved successfully"
    )
  );
});

/**
 * Admin: Update flash sale
 */
export const updateAdminFlashSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await FlashSaleService.updateFlashSale(id, req.body);

  return res.status(200).json(
    new ApiResponse(
      200,
      updated,
      "Flash sale updated successfully"
    )
  );
});

/**
 * Admin: Toggle flash sale status
 */
export const toggleAdminFlashSaleStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const updated = await FlashSaleService.toggleFlashSaleStatus(id, isActive);

  return res.status(200).json(
    new ApiResponse(
      200,
      updated,
      `Flash sale status updated to ${isActive ? "active" : "inactive"}`
    )
  );
});

/**
 * Admin: Delete flash sale
 */
export const deleteAdminFlashSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await FlashSaleService.deleteFlashSale(id);

  return res.status(200).json(
    new ApiResponse(
      200,
      { id },
      "Flash sale deleted successfully"
    )
  );
});
