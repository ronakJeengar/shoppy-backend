import crypto from "crypto";
import { AiError } from "../errors/aiError.js";

// Global in-memory storage for pending action confirmations
export const memoryPendingConfirmations = new Map();

export const CONFIRMATION_STATUS = {
  READY: "READY",
  ACTION_PROPOSED: "ACTION_PROPOSED",
  WAITING_FOR_CONFIRMATION: "WAITING_FOR_CONFIRMATION",
  CONFIRMED: "CONFIRMED",
  EXECUTING: "EXECUTING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  FAILED: "FAILED",
};

export class ConfirmationService {
  constructor(store = memoryPendingConfirmations) {
    this.store = store;
  }

  /**
   * Generates a cryptographically secure, unique confirmation token.
   */
  _generateConfirmationId() {
    return `conf_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  }

  /**
   * Register a consequential action awaiting explicit user confirmation.
   * Default TTL is 5 minutes (300,000 ms).
   */
  createConfirmation({
    conversationId = null,
    userId,
    action,
    toolName,
    arguments: args = {},
    summary,
    details = {},
    ttlMs = 300000,
  }) {
    if (!userId) {
      throw new Error("User ID is required to create a confirmation request");
    }
    if (!action || !toolName) {
      throw new Error("Action name and tool name are required");
    }

    const confirmationId = this._generateConfirmationId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    const record = {
      confirmationId,
      conversationId: conversationId ? conversationId.toString() : null,
      userId: userId.toString(),
      action,
      toolName,
      arguments: args,
      summary: summary || `Confirm ${action}`,
      details,
      status: CONFIRMATION_STATUS.WAITING_FOR_CONFIRMATION,
      createdAt: now,
      expiresAt,
      confirmedAt: null,
      executionResult: null,
    };

    this.store.set(confirmationId, record);
    return record;
  }

  /**
   * Retrieves a confirmation record by ID, checking expiration lazily.
   */
  getConfirmation(confirmationId) {
    if (!confirmationId) return null;
    const record = this.store.get(confirmationId);
    if (!record) return null;

    // Check expiration lazily
    if (
      record.status === CONFIRMATION_STATUS.WAITING_FOR_CONFIRMATION &&
      new Date() > new Date(record.expiresAt)
    ) {
      record.status = CONFIRMATION_STATUS.EXPIRED;
      this.store.set(confirmationId, record);
    }

    return record;
  }

  /**
   * Validates confirmation for execution:
   * - Enforces non-expired TTL
   * - Enforces user ownership (anti-IDOR)
   * - Enforces single-use / anti-replay (must be in WAITING_FOR_CONFIRMATION state)
   */
  validateAndConsumeConfirmation({ confirmationId, userId, conversationId = null }) {
    if (!confirmationId) {
      throw new AiError(
        "AI_CONFIRMATION_INVALID",
        "Confirmation ID is required",
        { confirmationId },
        400
      );
    }

    const record = this.getConfirmation(confirmationId);
    if (!record) {
      throw new AiError(
        "AI_CONFIRMATION_NOT_FOUND",
        "Confirmation request not found or expired",
        { confirmationId },
        404
      );
    }

    // IDOR Protection: User ID must match owning user
    if (record.userId.toString() !== userId.toString()) {
      throw new AiError(
        "AI_CONFIRMATION_UNAUTHORIZED",
        "Unauthorized: This confirmation request belongs to another user",
        { confirmationId },
        403
      );
    }

    // Replay Attack & State Protection
    if (record.status === CONFIRMATION_STATUS.EXPIRED) {
      throw new AiError(
        "AI_CONFIRMATION_EXPIRED",
        "This confirmation request has expired (5-minute limit)",
        { confirmationId, expiredAt: record.expiresAt },
        400
      );
    }

    if (record.status === CONFIRMATION_STATUS.CANCELLED) {
      throw new AiError(
        "AI_CONFIRMATION_CANCELLED",
        "This action was previously cancelled",
        { confirmationId },
        400
      );
    }

    if (
      record.status === CONFIRMATION_STATUS.COMPLETED ||
      record.status === CONFIRMATION_STATUS.CONFIRMED ||
      record.status === CONFIRMATION_STATUS.EXECUTING
    ) {
      throw new AiError(
        "AI_CONFIRMATION_REPLAY",
        "This confirmation has already been used and cannot be replayed",
        { confirmationId },
        400
      );
    }

    if (record.status !== CONFIRMATION_STATUS.WAITING_FOR_CONFIRMATION) {
      throw new AiError(
        "AI_CONFIRMATION_INVALID_STATE",
        `Confirmation is in invalid state: ${record.status}`,
        { confirmationId, status: record.status },
        400
      );
    }

    // Mark confirmed
    record.status = CONFIRMATION_STATUS.CONFIRMED;
    record.confirmedAt = new Date();
    this.store.set(confirmationId, record);

    return record;
  }

  /**
   * User explicitly declines or cancels the proposed consequential action.
   */
  cancelConfirmation({ confirmationId, userId }) {
    const record = this.getConfirmation(confirmationId);
    if (!record) {
      throw new AiError(
        "AI_CONFIRMATION_NOT_FOUND",
        "Confirmation request not found",
        { confirmationId },
        404
      );
    }

    if (record.userId.toString() !== userId.toString()) {
      throw new AiError(
        "AI_CONFIRMATION_UNAUTHORIZED",
        "Unauthorized cancellation request",
        { confirmationId },
        403
      );
    }

    if (record.status !== CONFIRMATION_STATUS.WAITING_FOR_CONFIRMATION) {
      return record;
    }

    record.status = CONFIRMATION_STATUS.CANCELLED;
    this.store.set(confirmationId, record);
    return record;
  }

  /**
   * Mark execution completed with final output payload.
   */
  markCompleted(confirmationId, executionResult) {
    const record = this.store.get(confirmationId);
    if (record) {
      record.status = CONFIRMATION_STATUS.COMPLETED;
      record.executionResult = executionResult;
      this.store.set(confirmationId, record);
    }
  }

  /**
   * Mark execution failed with error reason.
   */
  markFailed(confirmationId, error) {
    const record = this.store.get(confirmationId);
    if (record) {
      record.status = CONFIRMATION_STATUS.FAILED;
      record.error = error?.message || String(error);
      this.store.set(confirmationId, record);
    }
  }
}

export const defaultConfirmationService = new ConfirmationService();
