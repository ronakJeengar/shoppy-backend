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
 */
export class MockEmbeddingProvider extends EmbeddingProvider {
  constructor(config = {}) {
    super(config);
    this.dimensions = config.dimensions || 64;
  }

  _generateVector(text) {
    const vec = new Array(this.dimensions).fill(0);
    const sanitized = String(text || "").toLowerCase();

    for (let i = 0; i < sanitized.length; i++) {
      const charCode = sanitized.charCodeAt(i);
      const dimIndex = (charCode * 7 + i) % this.dimensions;
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
