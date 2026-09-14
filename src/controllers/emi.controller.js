import { EmiService } from "../services/emi.service.js";
import { EmiCalculationService } from "../services/emiCalculation.service.js";
import { EmiPlan } from "../models/emi_plan.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Public: Get available EMI plans (with quotes if amount is specified)
 * GET /api/v1/emi/plans?amount=XXXX
 */
export const getEmiPlans = asyncHandler(async (req, res) => {
  const amount = req.query.amount ? Number(req.query.amount) : 0;
  if (isNaN(amount) || amount < 0) {
    throw new ApiError(400, "Amount must be a non-negative number");
  }

  const result = await EmiService.getPlans({
    amount,
    user: req.user || null,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "EMI plans retrieved successfully"));
});

/**
 * Public: Calculate standalone EMI quote
 * POST /api/v1/emi/calculate
 */
export const calculateEmiQuote = asyncHandler(async (req, res) => {
  const amount = req.body.principal !== undefined ? req.body.principal : req.body.amount;
  const {
    planId,
    tenureMonths,
    annualInterestRate,
    processingFee,
    processingFeeType,
  } = req.body;

  if (amount === undefined || tenureMonths === undefined) {
    throw new ApiError(400, "Principal/amount and tenureMonths are required");
  }

  if (planId) {
    const quote = await EmiService.validateAndCalculateSelectedPlan({
      planId,
      tenureMonths,
      amount,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, quote, "EMI calculation generated successfully"));
  }

  const quote = EmiCalculationService.calculateEmiQuote({
    principal: amount,
    tenureMonths,
    annualInterestRate: annualInterestRate ?? 0,
    processingFee: processingFee ?? 0,
    processingFeeType: processingFeeType || "FIXED",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, quote, "EMI calculation generated successfully"));
});

/**
 * Admin: List all EMI plans (active and inactive)
 * GET /api/v1/admin/emi/plans
 */
export const getAdminEmiPlans = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    const plans = await EmiPlan.find({}).sort({ displayPriority: 1, provider: 1 }).lean();
    return res
      .status(200)
      .json(new ApiResponse(200, { plans }, "Admin EMI plans retrieved successfully"));
  }

  const result = await EmiService.getPlans({ amount: 0 });
  return res
    .status(200)
    .json(new ApiResponse(200, { plans: result.plans }, "Admin EMI plans retrieved successfully"));
});

/**
 * Admin: Create a new EMI plan
 * POST /api/v1/admin/emi/plans
 */
export const createAdminEmiPlan = asyncHandler(async (req, res) => {
  const {
    provider,
    providerCode,
    providerType = "BANK",
    minAmount = 3000,
    maxAmount = 500000,
    tenures = [],
    displayPriority = 0,
    description = "",
    termsAndConditions = "",
  } = req.body;

  if (!provider || !providerCode) {
    throw new ApiError(400, "Provider name and providerCode are required");
  }

  if (!Array.isArray(tenures) || tenures.length === 0) {
    throw new ApiError(400, "At least one tenure option is required");
  }

  if (mongoose.connection.readyState === 1) {
    const plan = await EmiPlan.create({
      provider,
      providerCode: providerCode.toUpperCase(),
      providerType,
      minAmount,
      maxAmount,
      tenures,
      displayPriority,
      description,
      termsAndConditions,
      isActive: true,
    });

    const planObj = plan.toObject();
    planObj.id = planObj._id.toString();

    return res
      .status(201)
      .json(new ApiResponse(201, { plan: planObj, ...planObj }, "EMI plan created successfully"));
  }

  const offlineId = `plan_${Date.now()}`;
  const offlinePlan = {
    _id: offlineId,
    id: offlineId,
    provider,
    providerCode: providerCode.toUpperCase(),
    providerType,
    minAmount,
    maxAmount,
    tenures: tenures.map((t, idx) => ({
      _id: `tenure_${Date.now()}_${idx}`,
      tenureId: `tenure_${Date.now()}_${idx}`,
      ...t,
    })),
    displayPriority,
    description,
    termsAndConditions,
    isActive: true,
    createdAt: new Date(),
  };

  EmiService.addMemoryPlan(offlinePlan);

  return res
    .status(201)
    .json(new ApiResponse(201, { plan: offlinePlan, ...offlinePlan }, "EMI plan created successfully"));
});

/**
 * Admin: Update an EMI plan
 * PATCH /api/v1/admin/emi/plans/:id
 */
export const updateAdminEmiPlan = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    const plan = await EmiPlan.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      throw new ApiError(404, "EMI plan not found");
    }

    const planObj = plan.toObject ? plan.toObject() : plan;
    planObj.id = planObj._id.toString();

    return res
      .status(200)
      .json(new ApiResponse(200, { plan: planObj, ...planObj }, "EMI plan updated successfully"));
  }

  const updated = EmiService.updateMemoryPlan(id, req.body) || { _id: id, id, ...req.body };

  return res
    .status(200)
    .json(new ApiResponse(200, { plan: updated, ...updated }, "EMI plan updated successfully"));
});

/**
 * Admin: Toggle EMI plan active status
 * PATCH /api/v1/admin/emi/plans/:id/status
 */
export const toggleAdminEmiPlanStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    const plan = await EmiPlan.findById(id);
    if (!plan) {
      throw new ApiError(404, "EMI plan not found");
    }

    plan.isActive = typeof req.body.isActive === "boolean" ? req.body.isActive : !plan.isActive;
    await plan.save();

    const planObj = plan.toObject ? plan.toObject() : plan;
    planObj.id = planObj._id.toString();

    return res
      .status(200)
      .json(new ApiResponse(200, { plan: planObj, ...planObj }, `EMI plan ${plan.isActive ? "activated" : "deactivated"} successfully`));
  }

  const updated = EmiService.toggleMemoryPlan(id, req.body.isActive) || { _id: id, id, isActive: req.body.isActive ?? false };

  return res
    .status(200)
    .json(new ApiResponse(200, { plan: updated, ...updated }, "EMI plan status updated successfully"));
});

/**
 * Admin: Delete an EMI plan
 * DELETE /api/v1/admin/emi/plans/:id
 */
export const deleteAdminEmiPlan = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    const plan = await EmiPlan.findByIdAndDelete(id);
    if (!plan) {
      throw new ApiError(404, "EMI plan not found");
    }
  } else {
    EmiService.deleteMemoryPlan(id);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "EMI plan deleted successfully"));
});
