import crypto from "crypto";
import { ApiError } from "../../utils/apiError.js";

const VALID_SOURCE_TYPES = [
  "POLICY",
  "FAQ",
  "SHIPPING",
  "RETURNS",
  "PAYMENTS",
  "HELP",
  "PRODUCT",
  "OTHER",
];

const VALID_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"];
const VALID_VISIBILITIES = ["PUBLIC", "ADMIN"];

/**
 * Strips script tags, style tags, and dangerous executable markup
 * while preserving safe markdown and plain text.
 */
export function sanitizeDocumentContent(content) {
  if (typeof content !== "string") return "";

  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/javascript:[^\s"'>]+/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .trim();
}

/**
 * Computes deterministic SHA-256 hex digest for content deduplication & change detection.
 */
export function computeContentHash(content) {
  const normalized = String(content || "")
    .replace(/\r\n/g, "\n")
    .trim();
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Validates knowledge document attributes before ingestion.
 */
export function validateDocumentInput(input = {}) {
  const {
    title,
    sourceType,
    content,
    status = "ACTIVE",
    visibility = "PUBLIC",
    version = 1,
    language = "en",
    metadata = {},
  } = input;

  if (!title || typeof title !== "string" || !title.trim()) {
    throw new ApiError(400, "Document title is required and must be a non-empty string");
  }

  if (title.length > 200) {
    throw new ApiError(400, "Document title cannot exceed 200 characters");
  }

  const normalizedSourceType = String(sourceType || "").toUpperCase();
  if (!VALID_SOURCE_TYPES.includes(normalizedSourceType)) {
    throw new ApiError(
      400,
      `Invalid sourceType '${sourceType}'. Must be one of: ${VALID_SOURCE_TYPES.join(", ")}`
    );
  }

  if (!content || typeof content !== "string" || !content.trim()) {
    throw new ApiError(400, "Document content is required and cannot be empty");
  }

  if (content.length > 50000) {
    throw new ApiError(400, "Document content exceeds maximum allowed length (50,000 characters)");
  }

  const normalizedStatus = String(status).toUpperCase();
  if (!VALID_STATUSES.includes(normalizedStatus)) {
    throw new ApiError(
      400,
      `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }

  const normalizedVisibility = String(visibility).toUpperCase();
  if (!VALID_VISIBILITIES.includes(normalizedVisibility)) {
    throw new ApiError(
      400,
      `Invalid visibility '${visibility}'. Must be one of: ${VALID_VISIBILITIES.join(", ")}`
    );
  }

  const sanitizedContent = sanitizeDocumentContent(content);
  if (!sanitizedContent) {
    throw new ApiError(400, "Document content became empty after sanitization");
  }

  return {
    title: title.trim(),
    sourceType: normalizedSourceType,
    content: sanitizedContent,
    status: normalizedStatus,
    visibility: normalizedVisibility,
    version: typeof version === "number" && version > 0 ? version : 1,
    language: String(language || "en").toLowerCase().trim(),
    contentHash: computeContentHash(sanitizedContent),
    metadata: typeof metadata === "object" && metadata !== null ? metadata : {},
  };
}
