import mongoose, { Schema } from "mongoose";

const tenureOptionSchema = new Schema(
  {
    months: {
      type: Number,
      required: true,
      min: 1,
    },
    interestRate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    processingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    processingFeeType: {
      type: String,
      enum: ["FIXED", "PERCENTAGE"],
      default: "FIXED",
    },
    isNoCost: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const emiPlanSchema = new Schema(
  {
    provider: {
      type: String,
      required: [true, "EMI provider name is required"],
      trim: true,
    },
    providerCode: {
      type: String,
      required: [true, "EMI provider code is required"],
      trim: true,
      uppercase: true,
      index: true,
    },
    providerType: {
      type: String,
      enum: ["BANK", "NBFC", "FINTECH", "DEMO"],
      default: "BANK",
    },
    minAmount: {
      type: Number,
      default: 3000,
      min: 0,
    },
    maxAmount: {
      type: Number,
      default: 500000,
      min: 0,
    },
    tenures: {
      type: [tenureOptionSchema],
      required: true,
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validTo: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    displayPriority: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    termsAndConditions: {
      type: String,
      default: "Standard issuer terms and conditions apply. EMI conversion subject to bank approval.",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const EmiPlan = mongoose.model("EmiPlan", emiPlanSchema);
