import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { CampaignService } from "../services/campaign.service.js";

/**
 * Public/Customer: Get currently active campaigns/banners.
 * GET /api/v1/campaigns/active
 */
export const getActiveCampaigns = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const campaignType = req.query.type ? req.query.type.toUpperCase() : undefined;

  const campaigns = await CampaignService.getActiveCampaigns({
    now: new Date(),
    limit,
    campaignType,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        items: campaigns,
        count: campaigns.length,
      },
      "Active campaigns retrieved successfully"
    )
  );
});

/**
 * Public/Customer: Get single campaign by ID.
 * GET /api/v1/campaigns/:id
 */
export const getCampaignById = asyncHandler(async (req, res) => {
  const campaign = await CampaignService.getCampaignById(req.params.id);

  return res.status(200).json(
    new ApiResponse(200, campaign, "Campaign retrieved successfully")
  );
});

/**
 * Admin: List campaigns with pagination and filters.
 * GET /api/v1/admin/campaigns
 */
export const getAdminCampaigns = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const status = req.query.status || "all";
  const campaignType = req.query.type ? req.query.type.toUpperCase() : undefined;
  const search = req.query.search;

  const result = await CampaignService.listCampaigns({
    page,
    limit,
    status,
    campaignType,
    search,
  });

  return res.status(200).json(
    new ApiResponse(200, result, "Admin campaigns retrieved successfully")
  );
});

/**
 * Admin: Create a new campaign.
 * POST /api/v1/admin/campaigns
 */
export const createAdminCampaign = asyncHandler(async (req, res) => {
  const campaign = await CampaignService.createCampaign(req.body);

  return res.status(201).json(
    new ApiResponse(201, campaign, "Campaign created successfully")
  );
});

/**
 * Admin: Get campaign by ID.
 * GET /api/v1/admin/campaigns/:id
 */
export const getAdminCampaignById = asyncHandler(async (req, res) => {
  const campaign = await CampaignService.getCampaignById(req.params.id);

  return res.status(200).json(
    new ApiResponse(200, campaign, "Campaign retrieved successfully")
  );
});

/**
 * Admin: Update campaign.
 * PATCH /api/v1/admin/campaigns/:id
 */
export const updateAdminCampaign = asyncHandler(async (req, res) => {
  const campaign = await CampaignService.updateCampaign(req.params.id, req.body);

  return res.status(200).json(
    new ApiResponse(200, campaign, "Campaign updated successfully")
  );
});

/**
 * Admin: Toggle campaign status.
 * PATCH /api/v1/admin/campaigns/:id/status
 */
export const toggleAdminCampaignStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const campaign = await CampaignService.toggleCampaignStatus(
    req.params.id,
    isActive
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      campaign,
      `Campaign ${isActive ? "activated" : "deactivated"} successfully`
    )
  );
});

/**
 * Admin: Delete campaign.
 * DELETE /api/v1/admin/campaigns/:id
 */
export const deleteAdminCampaign = asyncHandler(async (req, res) => {
  await CampaignService.deleteCampaign(req.params.id);

  return res.status(200).json(
    new ApiResponse(200, null, "Campaign deleted successfully")
  );
});
