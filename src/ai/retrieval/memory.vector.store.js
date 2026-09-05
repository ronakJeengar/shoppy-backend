import { VectorStore } from "./vector.store.js";

export class MemoryVectorStore extends VectorStore {
  constructor() {
    super();
    this.documents = new Map();
  }

  _cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
  }

  async upsert(docs) {
    const list = Array.isArray(docs) ? docs : [docs];
    for (const doc of list) {
      if (!doc.id || !doc.vector) {
        throw new Error("VectorStore document must have 'id' and 'vector'");
      }
      this.documents.set(String(doc.id), {
        id: String(doc.id),
        vector: doc.vector,
        content: doc.content || "",
        metadata: doc.metadata || {},
      });
    }
    return list.length;
  }

  async search(queryVector, { topK = 5, filter = {} } = {}) {
    const results = [];

    for (const doc of this.documents.values()) {
      // Apply metadata filters if provided
      let matchesFilter = true;
      for (const [key, val] of Object.entries(filter)) {
        if (doc.metadata[key] !== val) {
          matchesFilter = false;
          break;
        }
      }

      if (!matchesFilter) continue;

      const score = this._cosineSimilarity(queryVector, doc.vector);
      results.push({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        score: Math.round(score * 1000) / 1000,
      });
    }

    // Sort descending by similarity score
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async delete(id) {
    return this.documents.delete(String(id));
  }

  async count() {
    return this.documents.size;
  }

  async addDocument({ id, content, metadata = {}, vector = null }) {
    let docVector = vector;
    if (!docVector) {
      const text = `${content} ${JSON.stringify(metadata)}`;
      docVector = new Array(32).fill(0);
      for (let i = 0; i < text.length; i++) {
        docVector[i % 32] += text.charCodeAt(i) / 255;
      }
      const norm = Math.sqrt(docVector.reduce((sum, v) => sum + v * v, 0)) || 1;
      docVector = docVector.map((v) => v / norm);
    }
    await this.upsert({ id, content, metadata, vector: docVector });
    return id;
  }

  async similaritySearch(query, options = {}) {
    let queryVector;
    if (typeof query === "string") {
      queryVector = new Array(32).fill(0);
      for (let i = 0; i < query.length; i++) {
        queryVector[i % 32] += query.charCodeAt(i) / 255;
      }
      const norm = Math.sqrt(queryVector.reduce((sum, v) => sum + v * v, 0)) || 1;
      queryVector = queryVector.map((v) => v / norm);
    } else {
      queryVector = query;
    }
    return this.search(queryVector, options);
  }

  async clear() {
    this.documents.clear();
  }
}

export const defaultVectorStore = new MemoryVectorStore();
