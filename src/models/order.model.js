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
    sku: {
      type: String,
      default: "",
    },
    hsnCode: {
      type: String,
      default: "8518",
    },
    gstRate: {
      type: Number,
      default: 18,
    },
    isTaxInclusive: {
      type: Boolean,
      default: true,
    },
    mrp: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    regularPrice: {
      type: Number,
    },
    isFlashSale: {
      type: Boolean,
      default: false,
    },
    flashSaleId: {
      type: Schema.Types.ObjectId,
      ref: "FlashSale",
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    taxableAmount: {
      type: Number,
      default: 0,
    },
    cgst: {
      type: Number,
      default: 0,
    },
    sgst: {
      type: Number,
      default: 0,
    },
    igst: {
      type: Number,
      default: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
    },
  },
  { _id: true }
);

const billingAddressSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, default: "" },
    addressLine2: { type: String, default: "" },
    streetAddress: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    stateCode: { type: String, default: "" },
    postalCode: { type: String, required: true },
    pinCode: { type: String },
    district: { type: String, default: "" },
    landmark: { type: String, default: "" },
    country: { type: String, default: "IN" },
    gstin: { type: String, default: "" },
  },
  { _id: false }
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

const shippingDetailsSnapshotSchema = new Schema(
  {
    method: { type: String, default: "STANDARD" },
    methodName: { type: String, default: "Standard Delivery" },
    shippingAmount: { type: Number, default: 0 },
    shippingZone: { type: String, default: "NATIONAL" },
    deliveryEstimate: {
      minDays: { type: Number, default: 3 },
      maxDays: { type: Number, default: 5 },
      formattedWindow: { type: String, default: "3–5 business days" },
      estimatedDeliveryDate: { type: String, default: "" },
    },
    destinationPinCode: { type: String, default: "" },
    destinationState: { type: String, default: "" },
    isFreeShipping: { type: Boolean, default: false },
  },
  { _id: false }
);

const codDetailsSnapshotSchema = new Schema(
  {
    isCod: { type: Boolean, default: false },
    fee: { type: Number, default: 0 },
    isFeeFree: { type: Boolean, default: false },
    freeAboveAmount: { type: Number, default: 1499 },
    minOrderValue: { type: Number, default: 299 },
    maxOrderValue: { type: Number, default: 50000 },
    eligibilitySnapshot: {
      isEligible: { type: Boolean, default: true },
      reasonCode: { type: String, default: "" },
      message: { type: String, default: "" },
      eligibleShippingZones: [{ type: String }],
    },
  },
  { _id: false }
);

const emiDetailsSnapshotSchema = new Schema(
  {
    isEmi: { type: Boolean, default: false },
    planId: { type: Schema.Types.ObjectId, ref: "EmiPlan" },
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
    isNoCost: { type: Boolean, default: false },
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
    billingAddress: {
      type: billingAddressSnapshotSchema,
    },
    shippingMethod: {
      type: String,
      enum: ["STANDARD", "EXPRESS"],
      default: "STANDARD",
    },
    shippingDetails: {
      type: shippingDetailsSnapshotSchema,
      default: () => ({}),
    },
    codFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    codDetails: {
      type: codDetailsSnapshotSchema,
      default: () => ({ isCod: false, fee: 0, isFeeFree: false }),
    },
    emiDetails: {
      type: emiDetailsSnapshotSchema,
      default: () => ({ isEmi: false }),
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
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    invoiceDate: {
      type: Date,
    },
    invoiceStatus: {
      type: String,
      enum: ["NOT_ISSUED", "ISSUED", "CANCELLED"],
      default: "NOT_ISSUED",
      index: true,
    },
    invoiceSnapshot: {
      type: Schema.Types.Mixed,
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
