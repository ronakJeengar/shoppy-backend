import mongoose, { Schema } from "mongoose";

const invoiceSequenceSchema = new Schema(
  {
    year: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    seq: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export const InvoiceSequence = mongoose.model(
  "InvoiceSequence",
  invoiceSequenceSchema
);
