import mongoose, { Schema } from "mongoose";

const interactionEventSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    sessionId: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "VIEW_PRODUCT",
        "SEARCH_CLICK",
        "ADD_TO_CART",
        "REMOVE_FROM_CART",
        "WISHLIST_ADD",
        "WISHLIST_REMOVE",
        "PURCHASE",
      ],
      index: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => new Map(),
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// TTL Index: automatically expire interaction events after 60 days to respect privacy and bounded storage
interactionEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });
// Compound index for user affinity aggregation
interactionEventSchema.index({ user: 1, eventType: 1, createdAt: -1 });
// Compound index for co-occurrence / product interaction metrics
interactionEventSchema.index({ product: 1, eventType: 1 });

export const InteractionEvent = mongoose.model(
  "InteractionEvent",
  interactionEventSchema
);
