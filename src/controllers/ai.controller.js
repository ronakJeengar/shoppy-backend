import { defaultAiService } from "../ai/services/aiService.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Controller for AI subsystem health status.
 * Returns readiness, provider information (without secrets), and enabled capabilities.
 */
export const getAiHealth = asyncHandler(async (req, res) => {
  const health = await defaultAiService.healthCheck();
  return res.status(200).json(
    new ApiResponse(
      200,
      health,
      "AI subsystem health status retrieved successfully"
    )
  );
});

/**
 * Controller for AI queries and conversational assistant testing.
 * Accepts user messages, applies safety & data minimization, and returns response.
 */
export const queryAi = asyncHandler(async (req, res) => {
  const { message, history = [], options = {} } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    throw new ApiError(400, "Message parameter is required and must be a non-empty string");
  }

  const result = await defaultAiService.processRequest({
    message,
    user: req.user || null,
    history,
    options,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      "AI query processed successfully"
    )
  );
});
