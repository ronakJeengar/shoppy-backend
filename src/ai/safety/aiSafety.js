import { sanitizeAiText } from "../observability/aiLogger.js";

// Common adversarial prompt injection indicators
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above|preceding)\s+(instructions|prompts|rules)/i,
  /forget\s+(all\s+)?(your\s+)?instructions/i,
  /system\s+prompt\s*:/i,
  /system\s+(instructions|prompt)\s+override/i,
  /you\s+are\s+now\s+(in\s+developer\s+mode|unfiltered|jailbroken|dan)/i,
  /(?:reveal|show|print|display)\s+(all\s+)?(your\s+)?(system\s+prompt|hidden\s+instructions|master\s+prompt|user\s+passwords|database\s+records)/i,
  /bypass\s+(all\s+)?(safety|rules|guardrails|filters|policy)/i,
  /override\s+(all\s+)?(security\s+policy|guardrails|safety)/i,
  /execute\s+(arbitrary\s+)?(code|sql|shell|bash|cmd)/i,
];

export const checkPromptInjection = (text) => {
  if (!text || typeof text !== "string") {
    return { isSafe: true };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isSafe: false,
        flaggedPattern: pattern.toString(),
        reason: "Potential prompt injection or instruction override attempt detected",
      };
    }
  }

  return { isSafe: true };
};

export const sanitizeUserInput = (input) => {
  if (typeof input !== "string") return "";
  // Trim, redact secrets, and limit reasonable length to prevent token exhaustion DoS
  const trimmed = input.trim().slice(0, 2000);
  return sanitizeAiText(trimmed);
};

// Explicit structural boundaries preventing untrusted data from escaping context
export const wrapTrustBoundary = {
  system: (instructions) =>
    `<<<SYSTEM_INSTRUCTIONS_BEGIN>>>\n${instructions.trim()}\n<<<SYSTEM_INSTRUCTIONS_END>>>`,

  userInput: (userInput) =>
    `<<<USER_INPUT_BEGIN>>>\n${userInput.trim()}\n<<<USER_INPUT_END>>>`,

  retrievedContext: (contextDocs) =>
    `<<<RETRIEVED_CONTEXT_BEGIN>>>\n${contextDocs.trim()}\n<<<RETRIEVED_CONTEXT_END>>>`,

  toolResult: (toolName, resultJson) =>
    `<<<TOOL_RESULT_BEGIN name="${toolName}">>>\n${JSON.stringify(resultJson, null, 2)}\n<<<TOOL_RESULT_END>>>`,
};

export const validateStructuredResponse = (response) => {
  if (!response || typeof response !== "object") {
    return {
      isValid: false,
      reason: "Response must be a non-null object",
    };
  }

  if (typeof response.content !== "string" && !Array.isArray(response.toolCalls)) {
    return {
      isValid: false,
      reason: "Response must contain either text content or tool calls",
    };
  }

  return { isValid: true };
};
