import mongoose, { Schema } from "mongoose";

const knowledgeChunkSchema = new Schema(
  {
    chunkId: {
      type: String,
      required: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    content: {
      type: String,
      required: true,
    },
    contentHash: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const knowledgeDocumentSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sourceType: {
      type: String,
      required: true,
      uppercase: true,
      enum: [
        "POLICY",
        "FAQ",
        "SHIPPING",
        "RETURNS",
        "PAYMENTS",
        "HELP",
        "PRODUCT",
        "OTHER",
      ],
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      uppercase: true,
      enum: ["DRAFT", "ACTIVE", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    language: {
      type: String,
      required: true,
      default: "en",
      lowercase: true,
      trim: true,
    },
    visibility: {
      type: String,
      required: true,
      uppercase: true,
      enum: ["PUBLIC", "ADMIN"],
      default: "PUBLIC",
      index: true,
    },
    contentHash: {
      type: String,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    chunks: [knowledgeChunkSchema],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for high-performance RAG query filtering
knowledgeDocumentSchema.index({ status: 1, visibility: 1, sourceType: 1 });
knowledgeDocumentSchema.index({ "metadata.productId": 1 });

export const KnowledgeDocument = mongoose.model(
  "KnowledgeDocument",
  knowledgeDocumentSchema
);
