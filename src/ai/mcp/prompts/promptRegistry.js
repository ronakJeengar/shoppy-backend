import { McpError } from "../protocol/mcpErrors.js";

export class PromptRegistry {
  constructor() {
    this.prompts = new Map([
      [
        "shopping_assistant",
        {
          name: "shopping_assistant",
          description: "Initialize shopping assistant persona with commercial guardrails and policy awareness",
          arguments: [
            {
              name: "user_query",
              description: "Customer initial shopping query or product need",
              required: false,
            },
          ],
          render: (args = {}) => {
            const query = args.user_query || "How can I help you find the right products today?";
            return {
              description: "Shoppy Assistant Persona Prompt",
              messages: [
                {
                  role: "system",
                  content: {
                    type: "text",
                    text: "You are the Shoppy Shopping Assistant. You help customers discover authentic products, verify inventory availability, check store policies, and manage their carts. Always use tool calling to retrieve real data before answering.",
                  },
                },
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: query,
                  },
                },
              ],
            };
          },
        },
      ],
      [
        "product_comparison",
        {
          name: "product_comparison",
          description: "Structure a factual comparison between two catalog products",
          arguments: [
            {
              name: "product_a",
              description: "First product identifier or name",
              required: true,
            },
            {
              name: "product_b",
              description: "Second product identifier or name",
              required: true,
            },
          ],
          render: (args = {}) => {
            if (!args.product_a || !args.product_b) {
              throw McpError.invalidParams("Arguments 'product_a' and 'product_b' are required");
            }
            return {
              description: `Product Comparison between '${args.product_a}' and '${args.product_b}'`,
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `Please compare the features, price, ratings, and specifications of '${args.product_a}' versus '${args.product_b}'. Use get_product_details to retrieve live details for each.`,
                  },
                },
              ],
            };
          },
        },
      ],
      [
        "order_help",
        {
          name: "order_help",
          description: "Support prompt template for order tracking and fulfillment inquiries",
          arguments: [
            {
              name: "order_id",
              description: "Order number or order ID",
              required: true,
            },
          ],
          render: (args = {}) => {
            if (!args.order_id) {
              throw McpError.invalidParams("Argument 'order_id' is required");
            }
            return {
              description: `Order Support Prompt for Order #${args.order_id}`,
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `What is the current status and tracking information for order '${args.order_id}'? If cancellation is requested, remember to check eligibility first.`,
                  },
                },
              ],
            };
          },
        },
      ],
    ]);
  }

  /**
   * List all registered MCP prompts.
   */
  listPrompts() {
    return Array.from(this.prompts.values()).map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    }));
  }

  /**
   * Get rendered prompt messages by name and arguments.
   */
  getPrompt(name, args = {}) {
    const prompt = this.prompts.get(name);
    if (!prompt) {
      throw new McpError(-32602, `Prompt '${name}' not found`);
    }
    return prompt.render(args);
  }
}

export const defaultPromptRegistry = new PromptRegistry();
