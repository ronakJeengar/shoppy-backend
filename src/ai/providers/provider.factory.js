import { aiConfig } from "../config/ai.config.js";
import { MockLLMProvider } from "./mock.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import { OpenAIProvider } from "./openai.provider.js";

export const createLLMProvider = (customConfig = {}) => {
  const config = { ...aiConfig, ...customConfig };
  const providerType = (config.provider || "mock").toLowerCase();

  switch (providerType) {
    case "gemini":
      if (config.apiKey) {
        return new GeminiProvider(config);
      }
      return new MockLLMProvider(config);

    case "openai":
      if (config.apiKey) {
        return new OpenAIProvider(config);
      }
      return new MockLLMProvider(config);

    case "mock":
    default:
      return new MockLLMProvider(config);
  }
};

let defaultProviderInstance = null;

export const getDefaultLLMProvider = () => {
  if (!defaultProviderInstance) {
    defaultProviderInstance = createLLMProvider();
  }
  return defaultProviderInstance;
};

export const _resetDefaultLLMProvider = () => {
  defaultProviderInstance = null;
};
