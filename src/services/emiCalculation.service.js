import { ApiError } from "../utils/apiError.js";

/**
 * Standard monetary rounding to 2 decimal places.
 * Prevents floating point accumulation bugs.
 */
export const round2 = (num) => {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

export class EmiCalculationService {
  /**
   * Calculate reducing balance EMI for a given principal, tenure, and interest rate.
   *
   * Formula:
   *   EMI = P * r * (1+r)^n / ((1+r)^n - 1)
   * where:
   *   P = principal (authoritative final checkout total)
   *   r = monthly interest rate (annualInterestRate / 12 / 100)
   *   n = tenure in months
   *
   * For 0% No-Cost EMI:
   *   EMI = P / n
   *   Total Interest = 0
   */
  static calculateEmiQuote({
    principal,
    tenureMonths,
    annualInterestRate = 0,
    processingFee = 0,
    processingFeeType = "FIXED",
  }) {
    const P = round2(principal);
    const n = parseInt(tenureMonths, 10);
    const R = Number(annualInterestRate);

    if (isNaN(P) || P < 0) {
      throw new ApiError(400, "Principal amount must be a non-negative number for EMI calculation");
    }

    if (P === 0) {
      return {
        principal: 0,
        tenureMonths: isNaN(n) ? 0 : n,
        interestRate: round2(isNaN(R) ? 0 : R),
        monthlyInstallment: 0,
        totalInterest: 0,
        processingFee: 0,
        processingFeeType: processingFeeType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
        totalRepaid: 0,
        totalPayable: 0,
        isNoCost: true,
      };
    }

    if (isNaN(n) || n <= 0) {
      throw new ApiError(400, "Tenure months must be a positive integer");
    }

    if (isNaN(R) || R < 0) {
      throw new ApiError(400, "Annual interest rate must be non-negative");
    }

    let monthlyInstallment = 0;
    let totalInterest = 0;
    let totalRepaid = 0;
    const isNoCost = R === 0;

    if (isNoCost) {
      monthlyInstallment = round2(P / n);
      totalRepaid = round2(monthlyInstallment * n);
      totalInterest = 0;
    } else {
      const monthlyRate = R / 12 / 100;
      const factor = Math.pow(1 + monthlyRate, n);
      const rawEmi = (P * monthlyRate * factor) / (factor - 1);
      monthlyInstallment = round2(rawEmi);
      totalRepaid = round2(monthlyInstallment * n);
      totalInterest = round2(Math.max(0, totalRepaid - P));
    }

    let computedProcessingFee = 0;
    if (processingFeeType === "PERCENTAGE") {
      computedProcessingFee = round2(P * (Number(processingFee || 0) / 100));
    } else {
      computedProcessingFee = round2(Number(processingFee || 0));
    }

    const totalPayable = round2(totalRepaid + computedProcessingFee);

    return {
      principal: P,
      tenureMonths: n,
      interestRate: round2(R),
      monthlyInstallment,
      totalInterest,
      processingFee: computedProcessingFee,
      processingFeeType: processingFeeType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
      totalRepaid,
      totalPayable,
      isNoCost,
    };
  }

  static calculateProcessingFee(principal, fee = 0, feeType = "FIXED") {
    const P = round2(principal);
    if (feeType === "PERCENTAGE") {
      return round2(P * (Number(fee || 0) / 100));
    }
    return round2(Number(fee || 0));
  }

  static calculateEmi(params) {
    return this.calculateEmiQuote(params);
  }
}
