import { wrapTrustBoundary, sanitizeUserInput } from "../safety/aiSafety.js";
import { ASSISTANT_PROMPT_V1 } from "./assistant.v1.js";

export const buildPromptMessages = ({
  systemPrompt = ASSISTANT_PROMPT_V1,
  userMessage,
  retrievedContext = "",
  history = [],
}) => {
  const messages = [];

  // 1. Enforce System Instructions inside strict trust boundaries
  let systemText = wrapTrustBoundary.system(systemPrompt.instructions);
  if (retrievedContext && retrievedContext.trim()) {
    systemText += `\n\n${wrapTrustBoundary.retrievedContext(retrievedContext)}`;
  }

  messages.push({
    role: "system",
    content: systemText,
  });

  // 2. Append sanitized conversation history
  for (const item of history) {
    if (item && item.role && item.content) {
      messages.push({
        role: item.role === "assistant" ? "assistant" : "user",
        content: sanitizeUserInput(item.content),
      });
    }
  }

  // 3. Append current user query
  messages.push({
    role: "user",
    content: wrapTrustBoundary.userInput(sanitizeUserInput(userMessage)),
  });

  return {
    promptVersion: `${systemPrompt.name}@${systemPrompt.version}`,
    messages,
  };
};
