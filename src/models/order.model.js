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
    country: { type: String, default: "US" },
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
      default: "USD",
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
