export const EMI_REASON_CODES = {
  DISABLED: "EMI_DISABLED",
  NOT_AVAILABLE: "EMI_NOT_AVAILABLE",
  AMOUNT_TOO_LOW: "EMI_AMOUNT_TOO_LOW",
  AMOUNT_TOO_HIGH: "EMI_AMOUNT_TOO_HIGH",
  NO_ACTIVE_PLANS: "EMI_NO_ACTIVE_PLANS",
  PLAN_EXPIRED: "EMI_PLAN_EXPIRED",
  PLAN_UNAVAILABLE: "EMI_PLAN_UNAVAILABLE",
  PROVIDER_UNAVAILABLE: "EMI_PROVIDER_UNAVAILABLE",
  INVALID_TENURE: "EMI_INVALID_TENURE",
};

export class EmiEligibilityService {
  /**
   * Evaluate whether a given cart/order amount qualifies for EMI payments.
   */
  static evaluateEligibility({
    amount,
    user = null,
    emiConfig = {},
    availablePlansCount = 1,
  }) {
    const isEnabled = emiConfig.enabled !== false;
    const minOrderValue = Number(emiConfig.minOrderValue ?? 3000);
    const maxOrderValue = Number(emiConfig.maxOrderValue ?? 500000);
    const numericAmount = Number(amount || 0);

    if (!isEnabled) {
      return {
        eligible: false,
        reasonCode: EMI_REASON_CODES.DISABLED,
        message: "EMI is currently unavailable.",
        minOrderValue,
        maxOrderValue,
        minAmount: minOrderValue,
        maxAmount: maxOrderValue,
      };
    }

    if (numericAmount < minOrderValue) {
      return {
        eligible: false,
        reasonCode: EMI_REASON_CODES.AMOUNT_TOO_LOW,
        message: `Order total ₹${numericAmount} is below the minimum EMI threshold of ₹${minOrderValue}.`,
        minOrderValue,
        maxOrderValue,
        minAmount: minOrderValue,
        maxAmount: maxOrderValue,
      };
    }

    if (numericAmount > maxOrderValue) {
      return {
        eligible: false,
        reasonCode: EMI_REASON_CODES.AMOUNT_TOO_HIGH,
        message: `Order total ₹${numericAmount} exceeds the maximum EMI limit of ₹${maxOrderValue}.`,
        minOrderValue,
        maxOrderValue,
        minAmount: minOrderValue,
        maxAmount: maxOrderValue,
      };
    }

    if (availablePlansCount === 0) {
      return {
        eligible: false,
        reasonCode: EMI_REASON_CODES.NO_ACTIVE_PLANS,
        message: "No active EMI plans are currently available for this order.",
        minOrderValue,
        maxOrderValue,
        minAmount: minOrderValue,
        maxAmount: maxOrderValue,
      };
    }

    return {
      eligible: true,
      reasonCode: null,
      message: null,
      minOrderValue,
      maxOrderValue,
      minAmount: minOrderValue,
      maxAmount: maxOrderValue,
    };
  }
}
