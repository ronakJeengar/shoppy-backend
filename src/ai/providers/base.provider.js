export class LLMProvider {
  constructor(config = {}) {
    this.config = config;
    this.providerName = "base";
  }

  /**
   * Generates a completion or tool calls given structured messages and tool definitions.
   * @param {Object} params
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {Array<Object>} [params.tools]
   * @param {Object} [params.options]
   * @returns {Promise<{content: string, toolCalls?: Array<Object>, usage?: Object}>}
   */
  async generateResponse({ messages, tools = [], options = {} }) {
    throw new Error("generateResponse must be implemented by subclass");
  }

  /**
   * Health check verifying connectivity.
   * @returns {Promise<{healthy: boolean, message?: string, latencyMs?: number}>}
   */
  async healthCheck() {
    throw new Error("healthCheck must be implemented by subclass");
  }
}
