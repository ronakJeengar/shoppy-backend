import mongoose, { Schema } from "mongoose";

const addressSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    streetAddress: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
    pinCode: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      default: "",
      trim: true,
    },
    landmark: {
      type: String,
      default: "",
      trim: true,
    },
    country: {
      type: String,
      default: "IN",
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Synchronize pinCode and postalCode
addressSchema.pre("validate", function (next) {
  if (this.pinCode && !this.postalCode) {
    this.postalCode = this.pinCode;
  }
  if (this.postalCode && !this.pinCode) {
    this.pinCode = this.postalCode;
  }
  next();
});

// If isDefault is set to true, unset any other default address for this user
addressSchema.pre("save", async function (next) {
  if (this.isModified("isDefault") && this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

export const Address = mongoose.model("Address", addressSchema);
