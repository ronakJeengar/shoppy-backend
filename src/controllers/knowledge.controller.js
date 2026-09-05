import mongoose from "mongoose";
import { defaultKnowledgeRetriever } from "../ai/rag/knowledgeRetriever.js";
import {
  defaultKnowledgeIngestionService,
  memoryKnowledgeStore,
} from "../ai/rag/knowledgeIngestionService.js";
import { KnowledgeDocument } from "../models/knowledge_document.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Public RAG retrieval endpoint for semantic knowledge queries.
 */
export const retrieveKnowledge = asyncHandler(async (req, res) => {
  const query = req.body.query || req.query.q || req.query.query;
  const sourceType = req.body.sourceType || req.query.sourceType;
  const topK = parseInt(req.body.topK || req.query.topK, 10) || 5;
  const minScore = parseFloat(req.body.minScore || req.query.minScore) || 0.35;

  if (!query || typeof query !== "string" || !query.trim()) {
    throw new ApiError(400, "Query parameter is required and must be a non-empty string");
  }

  // Ensure default knowledge is seeded if repository is empty
  await defaultKnowledgeIngestionService.bootstrapDefaults();

  const results = await defaultKnowledgeRetriever.retrieve({
    query: query.trim(),
    sourceType,
    topK,
    minScore,
    user: req.user || null,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        query: query.trim(),
        results,
        total: results.length,
      },
      "Knowledge retrieved successfully"
    )
  );
});

/**
 * Admin: List all knowledge documents with pagination and filters.
 */
export const getAdminKnowledgeDocuments = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status && req.query.status !== "ALL") {
    filter.status = req.query.status.toUpperCase();
  }
  if (req.query.sourceType) {
    filter.sourceType = req.query.sourceType.toUpperCase();
  }
  if (req.query.visibility) {
    filter.visibility = req.query.visibility.toUpperCase();
  }

  let documents = [];
  let total = 0;

  if (mongoose.connection.readyState === 1) {
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { content: { $regex: req.query.search, $options: "i" } },
      ];
    }
    const [docs, count] = await Promise.all([
      KnowledgeDocument.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      KnowledgeDocument.countDocuments(filter),
    ]);
    documents = docs;
    total = count;
  } else {
    let list = [...memoryKnowledgeStore];
    if (filter.status) {
      list = list.filter((d) => d.status === filter.status);
    }
    if (filter.sourceType) {
      list = list.filter((d) => d.sourceType === filter.sourceType);
    }
    if (filter.visibility) {
      list = list.filter((d) => d.visibility === filter.visibility);
    }
    if (req.query.search) {
      const q = req.query.search.toLowerCase();
      list = list.filter(
        (d) =>
          (d.title && d.title.toLowerCase().includes(q)) ||
          (d.content && d.content.toLowerCase().includes(q))
      );
    }
    total = list.length;
    documents = list.slice(skip, skip + limit);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        documents,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
      "Admin knowledge documents retrieved successfully"
    )
  );
});

/**
 * Admin: Create and ingest a new knowledge document.
 */
export const createAdminKnowledgeDocument = asyncHandler(async (req, res) => {
  const doc = await defaultKnowledgeIngestionService.ingestDocument(req.body);

  return res.status(201).json(
    new ApiResponse(
      201,
      doc,
      "Knowledge document created and ingested successfully"
    )
  );
});

/**
 * Admin: Get a single knowledge document by ID.
 */
export const getAdminKnowledgeDocumentById = asyncHandler(async (req, res) => {
  let doc = null;
  if (mongoose.connection.readyState === 1) {
    doc = await KnowledgeDocument.findById(req.params.id);
  } else {
    doc = memoryKnowledgeStore.find(
      (d) => String(d._id) === String(req.params.id) || String(d.id) === String(req.params.id)
    );
  }

  if (!doc) {
    throw new ApiError(404, "Knowledge document not found");
  }

  return res.status(200).json(
    new ApiResponse(200, doc, "Knowledge document retrieved successfully")
  );
});

/**
 * Admin: Update and re-ingest an existing knowledge document.
 */
export const updateAdminKnowledgeDocument = asyncHandler(async (req, res) => {
  let existingDoc = null;
  if (mongoose.connection.readyState === 1) {
    existingDoc = await KnowledgeDocument.findById(req.params.id);
  } else {
    existingDoc = memoryKnowledgeStore.find(
      (d) => String(d._id) === String(req.params.id) || String(d.id) === String(req.params.id)
    );
  }

  if (!existingDoc) {
    throw new ApiError(404, "Knowledge document not found");
  }

  const updatedInput = {
    ...(typeof existingDoc.toObject === "function" ? existingDoc.toObject() : existingDoc),
    ...req.body,
    _id: existingDoc._id || existingDoc.id,
  };

  const doc = await defaultKnowledgeIngestionService.ingestDocument(updatedInput, {
    existingDoc,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      doc,
      "Knowledge document updated and re-indexed successfully"
    )
  );
});

/**
 * Admin: Delete a knowledge document and purge its chunks from vector store.
 */
export const deleteAdminKnowledgeDocument = asyncHandler(async (req, res) => {
  const doc = await defaultKnowledgeIngestionService.deleteDocument(req.params.id);
  if (!doc) {
    throw new ApiError(404, "Knowledge document not found");
  }

  return res.status(200).json(
    new ApiResponse(200, null, "Knowledge document deleted and evicted from vector index")
  );
});

/**
 * Admin: Trigger complete re-indexing of all active knowledge documents.
 */
export const reindexAdminKnowledge = asyncHandler(async (req, res) => {
  const result = await defaultKnowledgeIngestionService.reindexAll();

  return res.status(200).json(
    new ApiResponse(200, result, "All active knowledge documents re-indexed successfully")
  );
});
