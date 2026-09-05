import mongoose from "mongoose";
import { KnowledgeDocument } from "../../models/knowledge_document.model.js";
import { validateDocumentInput } from "./documentValidator.js";
import { chunkDocument } from "./chunker.js";
import { defaultVectorStore } from "../retrieval/memory.vector.store.js";
import { MockEmbeddingProvider } from "../retrieval/embedding.provider.js";
import { DEFAULT_SHOPPY_KNOWLEDGE } from "./knowledge.seed.js";
import { logRagIngestionEvent } from "../observability/aiLogger.js";

export const memoryKnowledgeStore = [];
export const _resetMemoryKnowledgeStore = () => {
  memoryKnowledgeStore.length = 0;
};

export class KnowledgeIngestionService {
  constructor({
    vectorStore = defaultVectorStore,
    embeddingProvider = new MockEmbeddingProvider({ dimensions: 64 }),
  } = {}) {
    this.vectorStore = vectorStore;
    this.embeddingProvider = embeddingProvider;
    this.isInitialized = false;
  }

  /**
   * Ingests or updates a single knowledge document idempotently.
   */
  async ingestDocument(docInput, { existingDoc = null } = {}) {
    const startTime = Date.now();
    const validated = validateDocumentInput(docInput);

    let doc = existingDoc;
    const searchId = docInput._id || docInput.id;

    if (!doc && searchId) {
      if (mongoose.connection.readyState === 1) {
        doc = await KnowledgeDocument.findById(searchId);
      } else {
        doc = memoryKnowledgeStore.find(
          (d) => String(d._id) === String(searchId) || String(d.id) === String(searchId)
        );
      }
    }

    const docId = doc ? String(doc._id || doc.id) : new mongoose.Types.ObjectId().toString();

    // Idempotency check: if document content, status, and visibility have not changed, skip re-embedding
    if (
      doc &&
      doc.contentHash === validated.contentHash &&
      doc.status === validated.status &&
      doc.visibility === validated.visibility &&
      doc.title === validated.title
    ) {
      logRagIngestionEvent({
        documentId: docId,
        title: validated.title,
        sourceType: validated.sourceType,
        chunkCount: doc.chunks ? doc.chunks.length : 0,
        isIdempotentSkip: true,
        durationMs: Date.now() - startTime,
        success: true,
      });
      return doc;
    }

    // If document already had chunks indexed, evict old chunks before re-indexing
    if (doc && Array.isArray(doc.chunks) && doc.chunks.length > 0) {
      for (const oldChunk of doc.chunks) {
        await this.vectorStore.delete(oldChunk.chunkId);
      }
    }

    // Generate semantic chunks
    const chunks = chunkDocument({
      documentId: docId,
      title: validated.title,
      content: validated.content,
      sourceType: validated.sourceType,
      visibility: validated.visibility,
      version: validated.version,
      metadata: validated.metadata,
    });

    // Only index ACTIVE documents into vector store
    if (validated.status === "ACTIVE" && chunks.length > 0) {
      const textsToEmbed = chunks.map((c) => `${c.title}: ${c.content}`);
      const vectors = await this.embeddingProvider.embedBatch(textsToEmbed);

      const vectorDocs = chunks.map((chunk, idx) => ({
        id: chunk.chunkId,
        content: chunk.content,
        metadata: {
          ...chunk.metadata,
          documentId: docId,
          chunkId: chunk.chunkId,
          title: chunk.title,
          sourceType: validated.sourceType,
          visibility: validated.visibility,
          status: validated.status,
          version: validated.version,
          contentHash: chunk.contentHash,
          documentTitle: validated.title,
        },
        vector: vectors[idx],
      }));

      await this.vectorStore.upsert(vectorDocs);
    }

    // Persist document in MongoDB or offline memory store
    if (mongoose.connection.readyState === 1) {
      if (doc) {
        Object.assign(doc, validated);
        doc.chunks = chunks;
        await doc.save();
      } else {
        doc = await KnowledgeDocument.create({
          _id: docId,
          ...validated,
          chunks,
        });
      }
    } else {
      if (doc) {
        Object.assign(doc, validated);
        doc.chunks = chunks;
        doc.updatedAt = new Date();
      } else {
        doc = {
          _id: docId,
          id: docId,
          ...validated,
          chunks,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memoryKnowledgeStore.push(doc);
      }
    }

    logRagIngestionEvent({
      documentId: docId,
      title: validated.title,
      sourceType: validated.sourceType,
      chunkCount: chunks.length,
      isIdempotentSkip: false,
      durationMs: Date.now() - startTime,
      success: true,
    });

    return doc;
  }

  /**
   * Deletes a knowledge document and evicts its chunks from the vector store.
   */
  async deleteDocument(documentId) {
    let doc = null;

    if (mongoose.connection.readyState === 1) {
      doc = await KnowledgeDocument.findById(documentId);
      if (!doc) return null;

      if (Array.isArray(doc.chunks)) {
        for (const chunk of doc.chunks) {
          await this.vectorStore.delete(chunk.chunkId);
        }
      }
      await KnowledgeDocument.findByIdAndDelete(documentId);
    } else {
      const idx = memoryKnowledgeStore.findIndex(
        (d) => String(d._id) === String(documentId) || String(d.id) === String(documentId)
      );
      if (idx === -1) return null;

      doc = memoryKnowledgeStore[idx];
      if (Array.isArray(doc.chunks)) {
        for (const chunk of doc.chunks) {
          await this.vectorStore.delete(chunk.chunkId);
        }
      }
      memoryKnowledgeStore.splice(idx, 1);
    }

    return doc;
  }

  /**
   * Reindexes all ACTIVE knowledge documents in the database.
   */
  async reindexAll() {
    const activeDocs =
      mongoose.connection.readyState === 1
        ? await KnowledgeDocument.find({ status: "ACTIVE" })
        : memoryKnowledgeStore.filter((d) => d.status === "ACTIVE");

    let totalChunks = 0;

    for (const doc of activeDocs) {
      if (Array.isArray(doc.chunks) && doc.chunks.length > 0) {
        const textsToEmbed = doc.chunks.map((c) => `${c.title}: ${c.content}`);
        const vectors = await this.embeddingProvider.embedBatch(textsToEmbed);

        const vectorDocs = doc.chunks.map((chunk, idx) => ({
          id: chunk.chunkId,
          content: chunk.content,
          metadata: {
            ...chunk.metadata,
            documentId: String(doc._id || doc.id),
            chunkId: chunk.chunkId,
            title: chunk.title,
            sourceType: doc.sourceType,
            visibility: doc.visibility,
            status: doc.status,
            version: doc.version,
            contentHash: chunk.contentHash,
            documentTitle: doc.title,
          },
          vector: vectors[idx],
        }));

        await this.vectorStore.upsert(vectorDocs);
        totalChunks += vectorDocs.length;
      }
    }

    this.isInitialized = true;
    return { reindexedDocuments: activeDocs.length, totalChunks };
  }

  /**
   * Bootstraps default Shoppy policies and FAQs into the knowledge repository.
   */
  async bootstrapDefaults({ force = false } = {}) {
    const count =
      mongoose.connection.readyState === 1
        ? await KnowledgeDocument.countDocuments()
        : memoryKnowledgeStore.length;

    if (count > 0 && !force) {
      if (!this.isInitialized) {
        await this.reindexAll();
      }
      return 0;
    }

    let seededCount = 0;
    for (const seedItem of DEFAULT_SHOPPY_KNOWLEDGE) {
      await this.ingestDocument(seedItem);
      seededCount++;
    }

    this.isInitialized = true;
    return seededCount;
  }
}

export const defaultKnowledgeIngestionService = new KnowledgeIngestionService();
