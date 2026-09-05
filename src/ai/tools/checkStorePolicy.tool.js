import { AITool } from "./base.tool.js";

export class CheckStorePolicyTool extends AITool {
  constructor() {
    super({
      name: "check_store_policy",
      description:
        "Retrieve authoritative store policy details regarding returns, shipping times, warranty, or accepted payments.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["returns", "shipping", "warranty", "payments", "all"],
            description: "The policy topic to look up",
          },
        },
        required: ["topic"],
      },
      requiresAuth: false,
    });
  }

  async execute({ topic }, context) {
    const policies = {
      returns: {
        windowDays: 30,
        condition: "Items must be in original, unwashed packaging with all tags attached.",
        refundMethod: "Refunded to original payment method within 5-7 business days after return inspection.",
        freeReturns: true,
      },
      shipping: {
        standardDelivery: "3 to 5 business days across domestic addresses.",
        expressDelivery: "1 to 2 business days for orders placed before 2 PM.",
        freeShippingThreshold: 50.0,
      },
      warranty: {
        electronicsWarranty: "1 year manufacturer warranty covering hardware defects.",
        accessoriesWarranty: "6 months standard coverage.",
      },
      payments: {
        acceptedMethods: ["Credit/Debit Card", "UPI", "Net Banking", "Cash on Delivery"],
        security: "PCI-DSS compliant 256-bit encrypted checkout.",
      },
    };

    const key = String(topic || "").toLowerCase();
    if (key === "all" || !policies[key]) {
      return policies;
    }

    return { topic: key, ...policies[key] };
  }
}
