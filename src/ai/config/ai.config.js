import dotenv from "dotenv";
dotenv.config();

export const aiConfig = {
  enabled: process.env.AI_ENABLED === "true" || process.env.NODE_ENV === "test" || !process.env.AI_ENABLED,
  provider: process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "mock"),
  model: process.env.AI_MODEL || (process.env.AI_PROVIDER === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash"),
  apiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "",
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS, 10) || 10000,
  maxTokens: parseInt(process.env.AI_MAX_TOKENS, 10) || 1024,
  temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.2,

  // Feature Flags
  features: {
    assistantEnabled: process.env.AI_ASSISTANT_ENABLED !== "false",
    semanticSearchEnabled: process.env.AI_SEARCH_ENABLED !== "false",
    recommendationsEnabled: false, // Reserved for Phase 16
    toolCallingEnabled: true,
  },

  // Embeddings & Vector Search configuration
  retrieval: {
    embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-004",
    vectorDimensions: 768,
    topK: 5,
    similarityThreshold: 0.7,
  },
};

export const getAiConfig = () => ({ ...aiConfig });
