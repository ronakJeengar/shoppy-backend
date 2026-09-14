import mongoose from "mongoose";
import { EmiPlan } from "../models/emi_plan.model.js";
import { AppConfig } from "../models/app_config.model.js";
import { EmiCalculationService, round2 } from "./emiCalculation.service.js";
import { EmiEligibilityService, EMI_REASON_CODES } from "./emiEligibility.service.js";
import { ApiError } from "../utils/apiError.js";

export const DEFAULT_EMI_CONFIG = {
  enabled: true,
  minOrderValue: 3000,
  maxOrderValue: 500000,
  defaultProcessingFee: 99,
  defaultProcessingFeeType: "FIXED",
};

export const DEFAULT_DEV_EMI_PLANS = [
  {
    _id: "66e400000000000000000001",
    provider: "HDFC Bank",
    providerCode: "HDFC",
    providerType: "BANK",
    minAmount: 3000,
    maxAmount: 500000,
    displayPriority: 1,
    isActive: true,
    tenures: [
      { _id: "66e400000000000000000011", months: 3, interestRate: 0, processingFee: 99, processingFeeType: "FIXED", isNoCost: true, isActive: true },
      { _id: "66e400000000000000000012", months: 6, interestRate: 13.0, processingFee: 199, processingFeeType: "FIXED", isNoCost: false, isActive: true },
      { _id: "66e400000000000000000013", months: 9, interestRate: 14.0, processingFee: 199, processingFeeType: "FIXED", isNoCost: false, isActive: true },
      { _id: "66e400000000000000000014", months: 12, interestRate: 15.0, processingFee: 199, processingFeeType: "FIXED", isNoCost: false, isActive: true },
    ],
  },
  {
    _id: "66e400000000000000000002",
    provider: "ICICI Bank",
    providerCode: "ICICI",
    providerType: "BANK",
    minAmount: 3000,
    maxAmount: 500000,
    displayPriority: 2,
    isActive: true,
    tenures: [
      { _id: "66e400000000000000000021", months: 3, interestRate: 0, processingFee: 99, processingFeeType: "FIXED", isNoCost: true, isActive: true },
      { _id: "66e400000000000000000022", months: 6, interestRate: 12.5, processingFee: 199, processingFeeType: "FIXED", isNoCost: false, isActive: true },
      { _id: "66e400000000000000000023", months: 9, interestRate: 13.5, processingFee: 199, processingFeeType: "FIXED", isNoCost: false, isActive: true },
      { _id: "66e400000000000000000024", months: 12, interestRate: 14.5, processingFee: 199, processingFeeType: "FIXED", isNoCost: false, isActive: true },
    ],
  },
  {
    _id: "66e400000000000000000003",
    provider: "State Bank of India",
    providerCode: "SBI",
    providerType: "BANK",
    minAmount: 3000,
    maxAmount: 500000,
    displayPriority: 3,
    isActive: true,
    tenures: [
      { _id: "66e400000000000000000031", months: 6, interestRate: 12.0, processingFee: 99, processingFeeType: "FIXED", isNoCost: false, isActive: true },
      { _id: "66e400000000000000000032", months: 9, interestRate: 13.0, processingFee: 99, processingFeeType: "FIXED", isNoCost: false, isActive: true },
      { _id: "66e400000000000000000033", months: 12, interestRate: 14.0, processingFee: 99, processingFeeType: "FIXED", isNoCost: false, isActive: true },
    ],
  },
  {
    _id: "66e400000000000000000004",
    provider: "Axis Bank",
    providerCode: "AXIS",
    providerType: "BANK",
    minAmount: 3000,
    maxAmount: 500000,
    displayPriority: 4,
    isActive: true,
    tenures: [
      { _id: "66e400000000000000000041", months: 3, interestRate: 0, processingFee: 99, processingFeeType: "FIXED", isNoCost: true, isActive: true },
      { _id: "66e400000000000000000042", months: 6, interestRate: 13.0, processingFee: 199, processingFeeType: "FIXED", isNoCost: false, isActive: true },
      { _id: "66e400000000000000000043", months: 12, interestRate: 15.0, processingFee: 199, processingFeeType: "FIXED", isNoCost: false, isActive: true },
    ],
  },
  {
    _id: "66e400000000000000000005",
    provider: "Demo Bank",
    providerCode: "DEMO",
    providerType: "DEMO",
    minAmount: 1000,
    maxAmount: 500000,
    displayPriority: 5,
    isActive: true,
    tenures: [
      { _id: "66e400000000000000000051", months: 3, interestRate: 0, processingFee: 0, processingFeeType: "FIXED", isNoCost: true, isActive: true },
      { _id: "66e400000000000000000052", months: 6, interestRate: 10.0, processingFee: 50, processingFeeType: "FIXED", isNoCost: false, isActive: true },
      { _id: "66e400000000000000000053", months: 12, interestRate: 12.0, processingFee: 50, processingFeeType: "FIXED", isNoCost: false, isActive: true },
    ],
  },
];

// In-memory plan store for test runners
const inMemoryPlans = new Map();

const initializeMemoryPlans = () => {
  inMemoryPlans.clear();
  for (const plan of DEFAULT_DEV_EMI_PLANS) {
    inMemoryPlans.set(plan._id.toString(), JSON.parse(JSON.stringify(plan)));
  }
};

initializeMemoryPlans();

export class EmiService {
  static _resetMemoryPlans() {
    initializeMemoryPlans();
  }

  static addMemoryPlan(plan) {
    const id = plan.id || plan._id.toString();
    inMemoryPlans.set(id, { ...plan, _id: id, id });
    return inMemoryPlans.get(id);
  }

  static updateMemoryPlan(id, updates) {
    const existing = inMemoryPlans.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    inMemoryPlans.set(id, updated);
    return updated;
  }

  static toggleMemoryPlan(id, isActive) {
    const existing = inMemoryPlans.get(id);
    if (!existing) return null;
    existing.isActive = typeof isActive === "boolean" ? isActive : !existing.isActive;
    inMemoryPlans.set(id, existing);
    return existing;
  }

  static deleteMemoryPlan(id) {
    return inMemoryPlans.delete(id);
  }

  /**
   * Fetch active EMI configuration from AppConfig or fallback
   */
  static async getEmiConfig() {
    if (mongoose.connection.readyState === 1) {
      try {
        const appConfig = await AppConfig.findOne({ configKey: "DEFAULT_CONFIG" }).lean();
        if (appConfig?.commerce?.emi) {
          return {
            ...DEFAULT_EMI_CONFIG,
            ...appConfig.commerce.emi,
          };
        }
      } catch (err) {
        // Fallback to default
      }
    }
    return { ...DEFAULT_EMI_CONFIG };
  }

  /**
   * Seed default EMI plans if collection is empty
   */
  static async seedDefaultPlansIfEmpty() {
    if (mongoose.connection.readyState === 1) {
      const count = await EmiPlan.countDocuments();
      if (count === 0) {
        await EmiPlan.insertMany(DEFAULT_DEV_EMI_PLANS);
      }
    }
  }

  /**
   * Get available EMI plans with calculated quotes for a given amount
   */
  static async getPlans({ amount = 0, user = null, now = new Date() } = {}) {
    const numericAmount = round2(amount || 0);
    const emiConfig = await this.getEmiConfig();

    let rawPlans = [];

    if (mongoose.connection.readyState === 1) {
      await this.seedDefaultPlansIfEmpty();

      const query = {
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: now },
      };

      rawPlans = await EmiPlan.find(query).sort({ displayPriority: 1, provider: 1 }).lean();
    } else {
      rawPlans = Array.from(inMemoryPlans.values()).filter((p) => p.isActive);
    }

    // Evaluate basic global eligibility for the amount
    const eligibility = EmiEligibilityService.evaluateEligibility({
      amount: numericAmount,
      user,
      emiConfig,
      availablePlansCount: rawPlans.length,
    });

    const calculatedPlans = [];

    for (const plan of rawPlans) {
      const planMin = Number(plan.minAmount ?? 3000);
      const planMax = Number(plan.maxAmount ?? 500000);

      const isAmountEligibleForPlan =
        numericAmount <= 0 || (numericAmount >= planMin && numericAmount <= planMax);

      const activeTenures = (plan.tenures || []).filter((t) => t.isActive);

      const calculatedTenures = activeTenures.map((tenure) => {
        if (numericAmount > 0) {
          const quote = EmiCalculationService.calculateEmiQuote({
            principal: numericAmount,
            tenureMonths: tenure.months,
            annualInterestRate: tenure.interestRate,
            processingFee: tenure.processingFee,
            processingFeeType: tenure.processingFeeType,
          });

          return {
            tenureId: tenure._id ? tenure._id.toString() : "",
            months: tenure.months,
            interestRate: tenure.interestRate,
            isNoCost: tenure.isNoCost || tenure.interestRate === 0,
            processingFee: quote.processingFee,
            processingFeeType: tenure.processingFeeType,
            monthlyInstallment: quote.monthlyInstallment,
            totalInterest: quote.totalInterest,
            totalRepaid: quote.totalRepaid,
            totalPayable: quote.totalPayable,
            quote,
          };
        }

        return {
          tenureId: tenure._id ? tenure._id.toString() : "",
          months: tenure.months,
          interestRate: tenure.interestRate,
          isNoCost: tenure.isNoCost || tenure.interestRate === 0,
          processingFee: tenure.processingFee,
          processingFeeType: tenure.processingFeeType,
          monthlyInstallment: 0,
          totalInterest: 0,
          totalRepaid: 0,
          totalPayable: 0,
          quote: null,
        };
      });

      calculatedPlans.push({
        id: plan._id.toString(),
        planId: plan._id.toString(),
        provider: plan.provider,
        providerCode: plan.providerCode,
        providerType: plan.providerType || "BANK",
        minAmount: planMin,
        maxAmount: planMax,
        isEligible: isAmountEligibleForPlan && eligibility.eligible,
        description: plan.description || "",
        termsAndConditions: plan.termsAndConditions || "",
        tenures: calculatedTenures,
      });
    }

    return {
      currency: "INR",
      currencySymbol: "₹",
      amount: numericAmount,
      eligible: eligibility.eligible,
      reasonCode: eligibility.reasonCode,
      message: eligibility.message,
      minOrderValue: eligibility.minOrderValue,
      maxOrderValue: eligibility.maxOrderValue,
      eligibility,
      plans: calculatedPlans,
    };
  }

  /**
   * Authoritatively validate a selected EMI plan and tenure at checkout
   * Returns immutable snapshot for Order and Payment
   */
  static async validateAndCalculateSelectedPlan({
    planId,
    tenureMonths,
    amount,
    now = new Date(),
  }) {
    const numericAmount = round2(amount);
    const months = parseInt(tenureMonths, 10);

    if (!planId) {
      throw new ApiError(400, "EMI plan ID is required", "EMI_PLAN_REQUIRED");
    }

    if (isNaN(months) || months <= 0) {
      throw new ApiError(400, "Valid tenure in months is required", EMI_REASON_CODES.INVALID_TENURE);
    }

    const emiConfig = await this.getEmiConfig();
    const globalEligibility = EmiEligibilityService.evaluateEligibility({
      amount: numericAmount,
      emiConfig,
    });

    if (!globalEligibility.eligible) {
      throw new ApiError(
        400,
        globalEligibility.message || "Order amount does not qualify for EMI",
        globalEligibility.reasonCode
      );
    }

    let plan = null;

    if (mongoose.connection.readyState === 1) {
      if (mongoose.Types.ObjectId.isValid(planId)) {
        plan = await EmiPlan.findById(planId).lean();
      } else {
        plan = await EmiPlan.findOne({ providerCode: planId.toUpperCase() }).lean();
      }
    } else {
      plan =
        inMemoryPlans.get(planId.toString()) ||
        Array.from(inMemoryPlans.values()).find(
          (p) => p.providerCode.toUpperCase() === planId.toString().toUpperCase()
        );
    }

    if (!plan || !plan.isActive) {
      throw new ApiError(400, "Selected EMI plan is inactive or unavailable", EMI_REASON_CODES.PLAN_UNAVAILABLE);
    }

    if (plan.validFrom && new Date(plan.validFrom) > now) {
      throw new ApiError(400, "Selected EMI plan has not started yet", EMI_REASON_CODES.PLAN_UNAVAILABLE);
    }

    if (plan.validTo && new Date(plan.validTo) < now) {
      throw new ApiError(400, "Selected EMI plan has expired", EMI_REASON_CODES.PLAN_EXPIRED);
    }

    if (numericAmount < plan.minAmount) {
      throw new ApiError(
        400,
        `Order amount ₹${numericAmount} is below the minimum limit of ₹${plan.minAmount} for ${plan.provider}`,
        EMI_REASON_CODES.AMOUNT_TOO_LOW
      );
    }

    if (numericAmount > plan.maxAmount) {
      throw new ApiError(
        400,
        `Order amount ₹${numericAmount} exceeds the maximum limit of ₹${plan.maxAmount} for ${plan.provider}`,
        EMI_REASON_CODES.AMOUNT_TOO_HIGH
      );
    }

    const matchedTenure = (plan.tenures || []).find(
      (t) => t.months === months && t.isActive
    );

    if (!matchedTenure) {
      throw new ApiError(
        400,
        `Selected tenure of ${months} months is not available for ${plan.provider}`,
        EMI_REASON_CODES.INVALID_TENURE
      );
    }

    const quote = EmiCalculationService.calculateEmiQuote({
      principal: numericAmount,
      tenureMonths: months,
      annualInterestRate: matchedTenure.interestRate,
      processingFee: matchedTenure.processingFee,
      processingFeeType: matchedTenure.processingFeeType,
    });

    return {
      isEmi: true,
      planId: plan._id.toString(),
      provider: plan.provider,
      providerCode: plan.providerCode,
      tenureMonths: months,
      interestRate: matchedTenure.interestRate,
      processingFee: quote.processingFee,
      processingFeeType: matchedTenure.processingFeeType,
      principal: quote.principal,
      monthlyInstallment: quote.monthlyInstallment,
      totalInterest: quote.totalInterest,
      totalPayable: quote.totalPayable,
      isNoCost: quote.isNoCost,
    };
  }
}
