export class VectorStore {
  async upsert(documents) {
    throw new Error("upsert must be implemented by subclass");
  }

  async search(queryVector, options = {}) {
    throw new Error("search must be implemented by subclass");
  }

  async delete(id) {
    throw new Error("delete must be implemented by subclass");
  }

  async count() {
    throw new Error("count must be implemented by subclass");
  }

  async clear() {
    throw new Error("clear must be implemented by subclass");
  }
}
