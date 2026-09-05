import dotenv from "dotenv";
dotenv.config();

export const aiConfig = {
  enabled: process.env.AI_ENABLED !== "false",
  provider: process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "mock"),
  model: process.env.AI_MODEL || (process.env.AI_PROVIDER === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash"),
  apiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "",
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS, 10) || 10000,
  maxTokens: parseInt(process.env.AI_MAX_TOKENS, 10) || 1024,
  temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.2,

  // Granular Feature Flags
  features: {
    assistantEnabled: process.env.AI_ASSISTANT_ENABLED !== "false",
    semanticSearchEnabled: process.env.AI_SEARCH_ENABLED !== "false",
    ragEnabled: process.env.AI_RAG_ENABLED !== "false",
    recommendationsEnabled: process.env.AI_RECOMMENDATIONS_ENABLED !== "false",
    mcpEnabled: process.env.MCP_ENABLED !== "false",
    toolCallingEnabled: process.env.AI_TOOLS_ENABLED !== "false",
  },

  // Embeddings & Vector Search configuration
  retrieval: {
    embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-004",
    vectorDimensions: 768,
    topK: 5,
    similarityThreshold: 0.35,
  },
};

/**
 * Re-evaluates configuration dynamically from environment variables.
 * Useful for runtime configuration toggles and testing kill-switch scenarios.
 */
export const reloadAiConfig = () => {
  aiConfig.enabled = process.env.AI_ENABLED !== "false";
  aiConfig.provider = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "mock");
  aiConfig.model = process.env.AI_MODEL || (process.env.AI_PROVIDER === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash");
  aiConfig.apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "";
  aiConfig.timeoutMs = parseInt(process.env.AI_TIMEOUT_MS, 10) || 10000;
  aiConfig.maxTokens = parseInt(process.env.AI_MAX_TOKENS, 10) || 1024;
  aiConfig.temperature = parseFloat(process.env.AI_TEMPERATURE) || 0.2;

  aiConfig.features.assistantEnabled = process.env.AI_ASSISTANT_ENABLED !== "false";
  aiConfig.features.semanticSearchEnabled = process.env.AI_SEARCH_ENABLED !== "false";
  aiConfig.features.ragEnabled = process.env.AI_RAG_ENABLED !== "false";
  aiConfig.features.recommendationsEnabled = process.env.AI_RECOMMENDATIONS_ENABLED !== "false";
  aiConfig.features.mcpEnabled = process.env.MCP_ENABLED !== "false";
  aiConfig.features.toolCallingEnabled = process.env.AI_TOOLS_ENABLED !== "false";

  return aiConfig;
};

export const isAiEnabled = () => aiConfig.enabled;

export const isFeatureEnabled = (featureName) => {
  if (!aiConfig.enabled) return false;
  return aiConfig.features[featureName] !== false;
};

export const getAiConfig = () => ({ ...aiConfig });
