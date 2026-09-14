import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["SIMULATED", "STRIPE", "RAZORPAY", "COD", "EMI"],
      default: "SIMULATED",
    },
    paymentMethod: {
      type: String,
      enum: ["CARD", "UPI", "COD", "EMI"],
      default: "CARD",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "AUTHORIZED",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },
    signature: {
      type: String,
      default: "",
    },
    emi: {
      planId: {
        type: Schema.Types.ObjectId,
        ref: "EmiPlan",
      },
      provider: { type: String, default: "" },
      providerCode: { type: String, default: "" },
      tenureMonths: { type: Number, default: 0 },
      interestRate: { type: Number, default: 0 },
      processingFee: { type: Number, default: 0 },
      processingFeeType: { type: String, default: "FIXED" },
      principal: { type: Number, default: 0 },
      monthlyInstallment: { type: Number, default: 0 },
      totalInterest: { type: Number, default: 0 },
      totalPayable: { type: Number, default: 0 },
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

export const Payment = mongoose.model("Payment", paymentSchema);
