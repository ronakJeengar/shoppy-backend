import mongoose from "mongoose";
import { AppConfig } from "../models/app_config.model.js";
import { ShippingService } from "./shipping.service.js";

export const COD_REASON_CODES = {
  DISABLED: "COD_DISABLED",
  CUSTOMER_BLOCKED: "COD_CUSTOMER_NOT_ELIGIBLE",
  ORDER_VALUE_TOO_LOW: "COD_ORDER_VALUE_TOO_LOW",
  ORDER_VALUE_TOO_HIGH: "COD_ORDER_VALUE_TOO_HIGH",
  LIMIT_EXCEEDED: "COD_LIMIT_EXCEEDED",
  PRODUCT_NOT_ELIGIBLE: "COD_PRODUCT_NOT_ELIGIBLE",
  PIN_NOT_SERVICEABLE: "COD_PIN_NOT_SERVICEABLE",
  NOT_AVAILABLE_FOR_PIN: "COD_NOT_AVAILABLE_FOR_PIN",
  SHIPPING_ZONE_UNSUPPORTED: "COD_SHIPPING_ZONE_UNSUPPORTED",
};

export const DEFAULT_COD_CONFIG = {
  enabled: true,
  minOrderValue: 299.0,
  maxOrderValue: 50000.0,
  fee: 40.0,
  freeAboveAmount: 1499.0,
  eligibleShippingZones: ["LOCAL", "REGIONAL", "NATIONAL"],
  maxItems: 10,
  firstOrderAllowed: true,
  guestAllowed: false,
};

// In-memory copy for offline mode and testing
let memoryCodConfig = { ...DEFAULT_COD_CONFIG };

export class CodService {
  /**
   * Get active COD configuration from AppConfig or defaults
   */
  static async getCodConfig() {
    if (mongoose.connection.readyState === 1) {
      try {
        const appConfig = await AppConfig.findOne({ configKey: "DEFAULT_CONFIG" }).lean();
        if (appConfig?.commerce?.cod) {
          return {
            ...DEFAULT_COD_CONFIG,
            ...appConfig.commerce.cod,
          };
        }
      } catch (err) {
        console.warn("MongoDB AppConfig lookup failed, falling back to memory COD config:", err.message);
      }
    }
    return { ...memoryCodConfig };
  }

  /**
   * Update COD configuration in DB and in-memory store
   */
  static async updateCodConfig(updates = {}) {
    memoryCodConfig = {
      ...memoryCodConfig,
      ...updates,
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const appConfig = await AppConfig.findOneAndUpdate(
          { configKey: "DEFAULT_CONFIG" },
          { $set: { "commerce.cod": memoryCodConfig } },
          { new: true, upsert: true }
        );
        return {
          ...DEFAULT_COD_CONFIG,
          ...appConfig?.commerce?.cod,
        };
      } catch (err) {
        console.warn("Failed to persist COD config update to MongoDB:", err.message);
      }
    }

    return { ...memoryCodConfig };
  }

  /**
   * Evaluate COD eligibility authoritatively based on cart, customer, limits, and PIN code
   */
  static async evaluateCodEligibility({
    user = null,
    cartItems = [],
    subtotal = 0,
    pinCode = "560001",
    shippingZone = null,
  }) {
    const config = await this.getCodConfig();
    const cleanSubtotal = Math.max(0, Math.round((Number(subtotal) || 0) * 100) / 100);

    const baseResult = {
      eligible: false,
      fee: 0.0,
      standardFee: Number(config.fee) || 40.0,
      isFeeFree: false,
      freeAboveAmount: Number(config.freeAboveAmount) || 1499.0,
      minOrderValue: Number(config.minOrderValue) || 299.0,
      maxOrderValue: Number(config.maxOrderValue) || 50000.0,
      reasonCode: null,
      message: "",
      eligibleShippingZones: config.eligibleShippingZones || ["LOCAL", "REGIONAL", "NATIONAL"],
    };

    // 1. Global Kill-Switch Check
    if (config.enabled === false) {
      return {
        ...baseResult,
        reasonCode: COD_REASON_CODES.DISABLED,
        message: "Cash on Delivery is currently disabled",
      };
    }

    // 2. Customer Risk Control / Blocked Check
    if (user?.isCodBlocked === true) {
      return {
        ...baseResult,
        reasonCode: COD_REASON_CODES.CUSTOMER_BLOCKED,
        message:
          "Cash on Delivery is unavailable for your account due to past order return or cancellation history",
      };
    }

    // 3. Minimum Order Value
    if (cleanSubtotal < config.minOrderValue) {
      return {
        ...baseResult,
        reasonCode: COD_REASON_CODES.ORDER_VALUE_TOO_LOW,
        message: `Cash on Delivery is only available for orders of at least ₹${config.minOrderValue}`,
      };
    }

    // 4. Maximum Order Value
    if (cleanSubtotal > config.maxOrderValue) {
      return {
        ...baseResult,
        reasonCode: COD_REASON_CODES.ORDER_VALUE_TOO_HIGH,
        message: `Cash on Delivery is not available for orders above ₹${config.maxOrderValue}`,
      };
    }

    // 5. Maximum Items / Quantity Limit
    const totalQuantity = (cartItems || []).reduce(
      (sum, item) => sum + (Number(item.quantity) || 1),
      0
    );
    if (config.maxItems && totalQuantity > config.maxItems) {
      return {
        ...baseResult,
        reasonCode: COD_REASON_CODES.LIMIT_EXCEEDED,
        message: `Cash on Delivery is not available for orders with more than ${config.maxItems} items`,
      };
    }

    // 6. Product-Level COD Eligibility Check
    for (const item of cartItems || []) {
      const productObj = item.product || item;
      if (productObj?.isCodEligible === false) {
        return {
          ...baseResult,
          reasonCode: COD_REASON_CODES.PRODUCT_NOT_ELIGIBLE,
          message: `Item "${item.productName || productObj.productName || "Product"}" is not eligible for Cash on Delivery`,
        };
      }
    }

    // 7. Destination PIN Code Serviceability & COD Availability
    let activeShippingZone = shippingZone;
    if (pinCode) {
      const serviceability = await ShippingService.checkServiceability(pinCode);
      if (!serviceability.serviceable) {
        return {
          ...baseResult,
          reasonCode: COD_REASON_CODES.PIN_NOT_SERVICEABLE,
          message:
            serviceability.message ||
            `Delivery is currently unavailable to PIN code ${pinCode}`,
        };
      }

      if (serviceability.codAvailable === false) {
        return {
          ...baseResult,
          reasonCode: COD_REASON_CODES.NOT_AVAILABLE_FOR_PIN,
          message: `Cash on Delivery is not available for PIN code ${pinCode}`,
        };
      }

      if (!activeShippingZone && serviceability.shippingZone) {
        activeShippingZone = serviceability.shippingZone;
      }
    }

    // 8. Shipping Zone Eligibility
    const zone = activeShippingZone || "NATIONAL";
    if (
      config.eligibleShippingZones &&
      config.eligibleShippingZones.length > 0 &&
      !config.eligibleShippingZones.includes(zone)
    ) {
      return {
        ...baseResult,
        reasonCode: COD_REASON_CODES.SHIPPING_ZONE_UNSUPPORTED,
        message: `Cash on Delivery is not supported in ${zone} shipping zone`,
      };
    }

    // 9. Authoritative Fee Calculation
    const isFeeFree = cleanSubtotal >= config.freeAboveAmount;
    const effectiveFee = isFeeFree ? 0.0 : Number(config.fee) || 40.0;

    return {
      ...baseResult,
      eligible: true,
      fee: effectiveFee,
      isFeeFree,
      reasonCode: null,
      message: isFeeFree
        ? "Cash on Delivery is available with Free COD fee"
        : `Cash on Delivery is available (₹${effectiveFee} convenience fee applies)`,
    };
  }

  // Helpers for testing
  static _setMemoryCodConfig(config) {
    memoryCodConfig = { ...DEFAULT_COD_CONFIG, ...config };
  }

  static _resetMemoryCodConfig() {
    memoryCodConfig = { ...DEFAULT_COD_CONFIG };
  }
}
