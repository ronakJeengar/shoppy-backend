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
      enum: ["SIMULATED", "STRIPE", "RAZORPAY", "COD"],
      default: "SIMULATED",
    },
    paymentMethod: {
      type: String,
      enum: ["CARD", "UPI", "COD"],
      default: "CARD",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
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
