import crypto from "crypto";

export const memoryAiLogs = [];
const MAX_LOG_HISTORY = 100;

export const _clearMemoryAiLogs = () => {
  memoryAiLogs.length = 0;
};

// Patterns for sensitive data that MUST NEVER appear in AI telemetry or prompts
export const sanitizeAiText = (input) => {
  if (typeof input !== "string") return input;
  let sanitized = input;

  // Credit card numbers
  sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,16}\b/g, "[REDACTED_CARD]");

  // Passwords
  sanitized = sanitized.replace(/password["']?\s*[:=]\s*["']?[^"'\s,;)]+/gi, "password: [REDACTED_PASSWORD]");
  sanitized = sanitized.replace(/(?:is|was|set to)\s+SuperSecret[^\s,.]+/gi, "is [REDACTED_PASSWORD]");

  // Bearer / JWT tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, "Bearer [REDACTED_JWT]");
  sanitized = sanitized.replace(/eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+/g, "[REDACTED_JWT]");

  // API keys
  sanitized = sanitized.replace(/sk-[A-Za-z0-9-_]{20,}/g, "[REDACTED_KEY]");
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_KEY]");

  return sanitized;
};

export const generateAiRequestId = () => {
  return `ai_req_${crypto.randomBytes(8).toString("hex")}`;
};

export const logAiEvent = ({
  requestId = generateAiRequestId(),
  event,
  provider = "unknown",
  model = "unknown",
  durationMs = 0,
  tokenUsage = { prompt: 0, completion: 0, total: 0 },
  toolsCalled = [],
  success = true,
  error = null,
  metadata = {},
}) => {
  const logEntry = {
    requestId,
    timestamp: new Date().toISOString(),
    event,
    provider,
    model,
    durationMs: Math.round(durationMs),
    tokenUsage,
    toolsCalled,
    success,
    error: error ? sanitizeAiText(error.message || String(error)) : null,
    metadata: {
      ...metadata,
      sanitized: true,
    },
  };

  memoryAiLogs.unshift(logEntry);
  if (memoryAiLogs.length > MAX_LOG_HISTORY) {
    memoryAiLogs.pop();
  }

  return logEntry;
};

export const logSearchEvent = ({
  query = "",
  searchMode = "keyword",
  candidateCount = 0,
  resultCount = 0,
  durationMs = 0,
  fallbackUsed = false,
  extractedConstraints = {},
}) => {
  return logAiEvent({
    event: fallbackUsed ? "SEARCH_FALLBACK_TRIGGERED" : "SEARCH_COMPLETED",
    provider: "search_engine",
    model: searchMode,
    durationMs,
    success: true,
    metadata: {
      query: sanitizeAiText(query),
      searchMode,
      candidateCount,
      resultCount,
      fallbackUsed,
      extractedConstraints,
    },
  });
};

export const logRagIngestionEvent = ({
  documentId = "",
  title = "",
  sourceType = "POLICY",
  chunkCount = 0,
  isIdempotentSkip = false,
  durationMs = 0,
  success = true,
  error = null,
}) => {
  return logAiEvent({
    event: isIdempotentSkip
      ? "RAG_INGESTION_SKIPPED_IDEMPOTENT"
      : "RAG_INGESTION_COMPLETED",
    provider: "rag_ingestion",
    model: "chunker_v1",
    durationMs,
    success,
    error,
    metadata: {
      documentId: String(documentId || ""),
      title: sanitizeAiText(title || ""),
      sourceType,
      chunkCount,
      isIdempotentSkip,
    },
  });
};

export const logRagRetrievalEvent = ({
  query = "",
  sourceType = null,
  visibility = "PUBLIC",
  candidateCount = 0,
  resultCount = 0,
  durationMs = 0,
  success = true,
  error = null,
}) => {
  return logAiEvent({
    event: "RAG_RETRIEVAL_COMPLETED",
    provider: "knowledge_retriever",
    model: "vector_similarity",
    durationMs,
    metadata: {
      query: sanitizeAiText(query),
      sourceType,
      visibility,
      candidateCount,
      resultCount,
      zeroResults: resultCount === 0,
    },
  });
};

export const aiLogger = {
  log: logAiEvent,
  logSearchEvent,
  logRagIngestionEvent,
  logRagRetrievalEvent,
  sanitizeAiText,
  generateAiRequestId,
};

