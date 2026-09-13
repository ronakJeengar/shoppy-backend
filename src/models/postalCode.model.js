import mongoose, { Schema } from "mongoose";

const postalCodeSchema = new Schema(
  {
    pinCode: {
      type: String,
      required: [true, "PIN code is required"],
      unique: true,
      trim: true,
      index: true,
      validate: {
        validator: function (v) {
          return /^[1-9][0-9]{5}$/.test(v);
        },
        message: "PIN code must be a valid 6-digit Indian postal code",
      },
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    district: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },
    stateCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    isServiceable: {
      type: Boolean,
      default: true,
      index: true,
    },
    standardDeliveryMinDays: {
      type: Number,
      default: 3,
      min: 0,
    },
    standardDeliveryMaxDays: {
      type: Number,
      default: 5,
      min: 0,
    },
    expressAvailable: {
      type: Boolean,
      default: true,
    },
    expressDeliveryMinDays: {
      type: Number,
      default: 1,
      min: 0,
    },
    expressDeliveryMaxDays: {
      type: Number,
      default: 2,
      min: 0,
    },
    shippingZone: {
      type: String,
      enum: ["LOCAL", "REGIONAL", "NATIONAL", "REMOTE"],
      default: "NATIONAL",
      index: true,
    },
    codAvailable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient serviceability lookup
postalCodeSchema.index({ pinCode: 1, isServiceable: 1, isActive: 1 });

export const PostalCode = mongoose.model("PostalCode", postalCodeSchema);
