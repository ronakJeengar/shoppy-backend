export class EmbeddingProvider {
  constructor(config = {}) {
    this.config = config;
    this.dimensions = config.dimensions || 768;
  }

  async embed(text) {
    throw new Error("embed must be implemented by subclass");
  }

  async embedBatch(texts) {
    throw new Error("embedBatch must be implemented by subclass");
  }
}

/**
 * Deterministic embedding provider generating normalized vectors for testing and local development.
 * Uses token-based hashing so that shared words and semantic terms produce high cosine similarity,
 * while non-overlapping vocabulary yields near-zero similarity.
 */
export class MockEmbeddingProvider extends EmbeddingProvider {
  constructor(config = {}) {
    super(config);
    this.dimensions = config.dimensions || 64;
  }

  _generateVector(text) {
    const vec = new Array(this.dimensions).fill(0);
    const sanitized = String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ");
    const words = sanitized.split(/\s+/).filter((w) => w.length > 1);

    if (words.length === 0) return vec;

    for (const word of words) {
      // DJB2-inspired hash to project token into vector dimension space
      let h = 5381;
      for (let i = 0; i < word.length; i++) {
        h = (h << 5) + h + word.charCodeAt(i);
      }
      const dimIndex = Math.abs(h) % this.dimensions;
      vec[dimIndex] += 1;
    }

    // L2 Normalize vector for cosine similarity
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
    return vec.map((val) => val / norm);
  }

  async embed(text) {
    return this._generateVector(text);
  }

  async embedBatch(texts) {
    return texts.map((t) => this._generateVector(t));
  }
}
