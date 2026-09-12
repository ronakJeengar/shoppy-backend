import mongoose, { Schema } from "mongoose";

const orderItemSnapshotSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    productImage: {
      type: String,
      default: "",
    },
    sellerName: {
      type: String,
      default: "Official Store",
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    lineTotal: {
      type: Number,
      required: true,
    },
  },
  { _id: true }
);

const shippingAddressSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    streetAddress: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    pinCode: { type: String },
    district: { type: String, default: "" },
    landmark: { type: String, default: "" },
    country: { type: String, default: "IN" },
  },
  { _id: false }
);

const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderItems: {
      type: [orderItemSnapshotSchema],
      required: true,
      validate: [
        (items) => items && items.length > 0,
        "Order must contain at least one item",
      ],
    },
    shippingAddress: {
      type: shippingAddressSnapshotSchema,
      required: true,
    },
    shippingMethod: {
      type: String,
      enum: ["STANDARD", "EXPRESS"],
      default: "STANDARD",
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      min: 0,
      default: 0,
    },
    coupon: {
      code: { type: String, trim: true, uppercase: true, default: "" },
      discountType: { type: String, enum: ["PERCENTAGE", "FIXED", ""], default: "" },
      discountValue: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
    },
    shippingFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxBreakdown: {
      taxableAmount: { type: Number, default: 0 },
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
      isInterState: { type: Boolean, default: false },
      originState: { type: String, default: "KARNATAKA" },
      customerState: { type: String, default: "" },
    },
    customerGstin: {
      type: String,
      default: "",
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
            v
          );
        },
        message: "Invalid GSTIN format (must be 15-character valid Indian GSTIN)",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Backwards-compatibility alias for legacy code
    orderPrice: {
      type: Number,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PENDING_PAYMENT",
      index: true,
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },
    carrier: {
      type: String,
      default: "",
    },
    trackingNumber: {
      type: String,
      default: "",
    },
    cancellationReason: {
      type: String,
      default: "",
    },
    cancelledAt: {
      type: Date,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: function () {
        return [
          {
            status: this.status || "PENDING_PAYMENT",
            timestamp: new Date(),
            note: "Order created",
          },
        ];
      },
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to ensure legacy orderPrice is synchronized with totalAmount
orderSchema.pre("save", function (next) {
  if (this.totalAmount !== undefined) {
    this.orderPrice = this.totalAmount;
  }
  next();
});

export const Order = mongoose.model("Order", orderSchema);
