import mongoose, { Schema } from "mongoose";

// In-memory fallback store for offline tests and non-MongoDB environments
export const memoryConversations = new Map();
export const _resetMemoryConversations = () => memoryConversations.clear();

const conversationMessageSchema = new Schema(
  {
    id: {
      type: String,
      default: () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system", "tool"],
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    products: [
      {
        id: String,
        name: String,
        price: Number,
        inStock: Boolean,
        stockCount: Number,
        rating: Number,
        seller: String,
        productImage: String,
        description: String,
      },
    ],
    sources: [
      {
        chunkId: String,
        documentId: String,
        title: String,
        section: String,
        sourceType: String,
        content: String,
        score: Number,
        citation: Schema.Types.Mixed,
      },
    ],
    actions: [
      {
        type: { type: String, required: true },
        label: { type: String, required: true },
        payload: { type: Schema.Types.Mixed, default: {} },
      },
    ],
    toolCalls: {
      type: Array,
      default: [],
    },
    toolResults: {
      type: Array,
      default: [],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    title: {
      type: String,
      trim: true,
      default: "Shopping Assistant Chat",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
    messages: [conversationMessageSchema],
    metadata: {
      clientPlatform: {
        type: String,
        default: "flutter",
      },
      totalTokens: {
        type: Number,
        default: 0,
      },
      lastActivityAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ user: 1, status: 1, updatedAt: -1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
