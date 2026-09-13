import mongoose from "mongoose";
import { PostalCode } from "../models/postalCode.model.js";
import { AppConfig } from "../models/app_config.model.js";

// Comprehensive fallback dataset for offline mode, seed validation, and test suites
export const fallbackPostalCodes = [
  {
    pinCode: "560001",
    city: "Bengaluru",
    district: "Bengaluru Urban",
    state: "Karnataka",
    stateCode: "KA",
    isServiceable: true,
    standardDeliveryMinDays: 2,
    standardDeliveryMaxDays: 3,
    expressAvailable: true,
    expressDeliveryMinDays: 1,
    expressDeliveryMaxDays: 2,
    shippingZone: "LOCAL",
    codAvailable: true,
    isActive: true,
  },
  {
    pinCode: "560038",
    city: "Bengaluru",
    district: "Bengaluru Urban",
    state: "Karnataka",
    stateCode: "KA",
    isServiceable: true,
    standardDeliveryMinDays: 2,
    standardDeliveryMaxDays: 3,
    expressAvailable: true,
    expressDeliveryMinDays: 1,
    expressDeliveryMaxDays: 2,
    shippingZone: "LOCAL",
    codAvailable: true,
    isActive: true,
  },
  {
    pinCode: "313001",
    city: "Udaipur",
    district: "Udaipur",
    state: "Rajasthan",
    stateCode: "RJ",
    isServiceable: true,
    standardDeliveryMinDays: 3,
    standardDeliveryMaxDays: 5,
    expressAvailable: true,
    expressDeliveryMinDays: 1,
    expressDeliveryMaxDays: 2,
    shippingZone: "REGIONAL",
    codAvailable: true,
    isActive: true,
  },
  {
    pinCode: "110001",
    city: "New Delhi",
    district: "Central Delhi",
    state: "Delhi",
    stateCode: "DL",
    isServiceable: true,
    standardDeliveryMinDays: 3,
    standardDeliveryMaxDays: 4,
    expressAvailable: true,
    expressDeliveryMinDays: 1,
    expressDeliveryMaxDays: 2,
    shippingZone: "NATIONAL",
    codAvailable: true,
    isActive: true,
  },
  {
    pinCode: "400001",
    city: "Mumbai",
    district: "Mumbai City",
    state: "Maharashtra",
    stateCode: "MH",
    isServiceable: true,
    standardDeliveryMinDays: 3,
    standardDeliveryMaxDays: 4,
    expressAvailable: true,
    expressDeliveryMinDays: 1,
    expressDeliveryMaxDays: 2,
    shippingZone: "NATIONAL",
    codAvailable: true,
    isActive: true,
  },
  {
    pinCode: "700001",
    city: "Kolkata",
    district: "Kolkata",
    state: "West Bengal",
    stateCode: "WB",
    isServiceable: true,
    standardDeliveryMinDays: 4,
    standardDeliveryMaxDays: 5,
    expressAvailable: true,
    expressDeliveryMinDays: 2,
    expressDeliveryMaxDays: 3,
    shippingZone: "NATIONAL",
    codAvailable: true,
    isActive: true,
  },
  {
    pinCode: "600001",
    city: "Chennai",
    district: "Chennai",
    state: "Tamil Nadu",
    stateCode: "TN",
    isServiceable: true,
    standardDeliveryMinDays: 3,
    standardDeliveryMaxDays: 4,
    expressAvailable: true,
    expressDeliveryMinDays: 1,
    expressDeliveryMaxDays: 2,
    shippingZone: "NATIONAL",
    codAvailable: true,
    isActive: true,
  },
  {
    pinCode: "194101",
    city: "Leh",
    district: "Leh",
    state: "Ladakh",
    stateCode: "LA",
    isServiceable: true,
    standardDeliveryMinDays: 6,
    standardDeliveryMaxDays: 9,
    expressAvailable: false,
    expressDeliveryMinDays: 0,
    expressDeliveryMaxDays: 0,
    shippingZone: "REMOTE",
    codAvailable: false,
    isActive: true,
  },
  {
    pinCode: "999999",
    city: "Test Unserviceable",
    district: "Test",
    state: "Test",
    stateCode: "XX",
    isServiceable: false,
    standardDeliveryMinDays: 0,
    standardDeliveryMaxDays: 0,
    expressAvailable: false,
    expressDeliveryMinDays: 0,
    expressDeliveryMaxDays: 0,
    shippingZone: "REMOTE",
    codAvailable: false,
    isActive: true,
  },
];

// In-memory store for test environment modifications
let memoryPostalCodes = [...fallbackPostalCodes];

export class ShippingService {
  /**
   * Reset in-memory postal codes (for testing)
   */
  static resetMemoryPostalCodes() {
    memoryPostalCodes = [...fallbackPostalCodes];
  }

  /**
   * Validate Indian PIN code format
   * Must be exactly 6 numeric digits, cannot start with 0
   */
  static validatePinCode(pinCode) {
    if (!pinCode) {
      return {
        isValid: false,
        normalizedPin: "",
        error: "PIN code is required",
      };
    }

    const normalized = pinCode.toString().trim();
    if (!/^[1-9][0-9]{5}$/.test(normalized)) {
      return {
        isValid: false,
        normalizedPin: normalized,
        error: "Invalid Indian PIN code. Must be exactly 6 digits and cannot start with 0.",
      };
    }

    return {
      isValid: true,
      normalizedPin: normalized,
      error: null,
    };
  }

  /**
   * Look up PIN code record from MongoDB or fallback store
   */
  static async findPostalRecord(pinCode) {
    const { isValid, normalizedPin } = this.validatePinCode(pinCode);
    if (!isValid) return null;

    if (mongoose.connection.readyState === 1) {
      try {
        const record = await PostalCode.findOne({ pinCode: normalizedPin }).lean();
        if (record) return record;
      } catch (err) {
        console.warn("MongoDB postal lookup failed, falling back to memory store:", err.message);
      }
    }

    return (
      memoryPostalCodes.find(
        (p) => p.pinCode === normalizedPin && p.isActive !== false
      ) || null
    );
  }

  /**
   * Check PIN code serviceability
   */
  static async checkServiceability(pinCode) {
    const validation = this.validatePinCode(pinCode);
    if (!validation.isValid) {
      return {
        serviceable: false,
        pinCode: validation.normalizedPin,
        message: validation.error,
        error: validation.error,
      };
    }

    const record = await this.findPostalRecord(validation.normalizedPin);
    if (!record || !record.isServiceable || record.isActive === false) {
      return {
        serviceable: false,
        pinCode: validation.normalizedPin,
        city: record?.city || "",
        state: record?.state || "",
        message: `Delivery is currently unavailable to PIN code ${validation.normalizedPin}`,
      };
    }

    return {
      serviceable: true,
      pinCode: record.pinCode,
      city: record.city,
      district: record.district || record.city,
      state: record.state,
      stateCode: record.stateCode || "",
      shippingZone: record.shippingZone || "NATIONAL",
      codAvailable: record.codAvailable !== false,
      delivery: {
        standard: {
          available: true,
          minDays: record.standardDeliveryMinDays || 3,
          maxDays: record.standardDeliveryMaxDays || 5,
        },
        express: {
          available: record.expressAvailable === true,
          minDays: record.expressDeliveryMinDays || 1,
          maxDays: record.expressDeliveryMaxDays || 2,
        },
      },
    };
  }

  /**
   * Get active shipping configuration from AppConfig or defaults
   */
  static async getShippingConfig() {
    let config = {
      freeShippingThreshold: 999.0,
      defaultShippingFee: 49.0,
      expressShippingFee: 99.0,
      remoteShippingSurcharge: 50.0,
      standardDeliveryMinDays: 3,
      standardDeliveryMaxDays: 5,
      expressDeliveryMinDays: 1,
      expressDeliveryMaxDays: 2,
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const appConfig = await AppConfig.findOne({ configKey: "DEFAULT_CONFIG" }).lean();
        if (appConfig?.commerce?.shipping) {
          config = { ...config, ...appConfig.commerce.shipping };
        }
      } catch (err) {
        console.warn("AppConfig lookup failed, using default shipping configuration:", err.message);
      }
    }

    return config;
  }

  /**
   * Calculate authoritative shipping quote based on PIN code, subtotal, and method
   */
  static async calculateShippingQuote({
    pinCode,
    subtotal = 0,
    shippingMethod = "STANDARD",
  }) {
    const serviceability = await this.checkServiceability(pinCode);
    const shippingConfig = await this.getShippingConfig();
    const cleanSubtotal = Math.max(0, Number(subtotal) || 0);

    if (!serviceability.serviceable) {
      return {
        currency: "INR",
        serviceable: false,
        pinCode: serviceability.pinCode || pinCode,
        message: serviceability.message || "Not serviceable",
        shippingAmount: 0,
        freeShipping: false,
        method: {
          code: shippingMethod,
          name: shippingMethod === "EXPRESS" ? "Express Delivery" : "Standard Delivery",
        },
        availableMethods: [],
        deliveryEstimate: null,
      };
    }

    // Determine available methods for this PIN code
    const availableMethods = [
      {
        code: "STANDARD",
        name: "Standard Delivery",
        minDays: serviceability.delivery.standard.minDays,
        maxDays: serviceability.delivery.standard.maxDays,
        baseCharge: shippingConfig.defaultShippingFee,
      },
    ];

    if (serviceability.delivery.express.available) {
      availableMethods.push({
        code: "EXPRESS",
        name: "Express Delivery",
        minDays: serviceability.delivery.express.minDays,
        maxDays: serviceability.delivery.express.maxDays,
        baseCharge: shippingConfig.expressShippingFee,
      });
    }

    const requestedMethod = shippingMethod.toUpperCase();
    const isExpressRequested = requestedMethod === "EXPRESS";
    const canDoExpress = isExpressRequested && serviceability.delivery.express.available;
    const finalMethodCode = canDoExpress ? "EXPRESS" : "STANDARD";
    const finalMethodName = finalMethodCode === "EXPRESS" ? "Express Delivery" : "Standard Delivery";

    // Free shipping applies if subtotal meets configured threshold (Standard delivery)
    const isFreeShipping =
      finalMethodCode === "STANDARD" &&
      cleanSubtotal >= shippingConfig.freeShippingThreshold;

    let shippingAmount = 0;
    if (finalMethodCode === "EXPRESS") {
      shippingAmount = shippingConfig.expressShippingFee;
    } else if (!isFreeShipping) {
      shippingAmount = shippingConfig.defaultShippingFee;
    }

    // Remote zone surcharge if applicable
    if (serviceability.shippingZone === "REMOTE") {
      shippingAmount += shippingConfig.remoteShippingSurcharge;
    }

    // Min and Max delivery days
    const minDays =
      finalMethodCode === "EXPRESS"
        ? serviceability.delivery.express.minDays
        : serviceability.delivery.standard.minDays;
    const maxDays =
      finalMethodCode === "EXPRESS"
        ? serviceability.delivery.express.maxDays
        : serviceability.delivery.standard.maxDays;

    const amountNeededForFreeShipping = Math.max(
      0,
      Number((shippingConfig.freeShippingThreshold - cleanSubtotal).toFixed(2))
    );

    return {
      currency: "INR",
      currencySymbol: "₹",
      serviceable: true,
      pinCode: serviceability.pinCode,
      city: serviceability.city,
      district: serviceability.district,
      state: serviceability.state,
      stateCode: serviceability.stateCode,
      shippingZone: serviceability.shippingZone,
      method: {
        code: finalMethodCode,
        name: finalMethodName,
        minDays,
        maxDays,
      },
      availableMethods,
      shippingAmount: Number(shippingAmount.toFixed(2)),
      freeShipping: isFreeShipping,
      freeShippingThreshold: shippingConfig.freeShippingThreshold,
      amountNeededForFreeShipping,
      deliveryEstimate: {
        minDays,
        maxDays,
        formattedWindow: `${minDays}–${maxDays} business days`,
      },
    };
  }

  /**
   * Admin: List postal codes with pagination & filters
   */
  static async listPostalCodes({
    page = 1,
    limit = 20,
    search = "",
    isServiceable = "all",
    zone = "all",
  }) {
    if (mongoose.connection.readyState === 1) {
      const query = {};
      if (search) {
        query.$or = [
          { pinCode: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
          { state: { $regex: search, $options: "i" } },
          { district: { $regex: search, $options: "i" } },
        ];
      }
      if (isServiceable !== "all") {
        query.isServiceable = isServiceable === "true" || isServiceable === true;
      }
      if (zone !== "all") {
        query.shippingZone = zone.toUpperCase();
      }

      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        PostalCode.find(query).sort({ pinCode: 1 }).skip(skip).limit(limit).lean(),
        PostalCode.countDocuments(query),
      ]);

      return {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // In-memory fallback for test runners
    let filtered = [...memoryPostalCodes];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.pinCode.includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.state.toLowerCase().includes(q)
      );
    }
    if (isServiceable !== "all") {
      const b = isServiceable === "true" || isServiceable === true;
      filtered = filtered.filter((p) => p.isServiceable === b);
    }
    if (zone !== "all") {
      filtered = filtered.filter((p) => p.shippingZone === zone.toUpperCase());
    }

    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      items,
      pagination: {
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit),
      },
    };
  }

  /**
   * Admin: Add or update postal code record
   */
  static async upsertPostalCode(data) {
    const validation = this.validatePinCode(data.pinCode);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const postalData = {
      pinCode: validation.normalizedPin,
      city: data.city,
      district: data.district || data.city,
      state: data.state,
      stateCode: data.stateCode || "",
      isServiceable: data.isServiceable !== false,
      standardDeliveryMinDays: Number(data.standardDeliveryMinDays) || 3,
      standardDeliveryMaxDays: Number(data.standardDeliveryMaxDays) || 5,
      expressAvailable: data.expressAvailable !== false,
      expressDeliveryMinDays: Number(data.expressDeliveryMinDays) || 1,
      expressDeliveryMaxDays: Number(data.expressDeliveryMaxDays) || 2,
      shippingZone: (data.shippingZone || "NATIONAL").toUpperCase(),
      codAvailable: data.codAvailable !== false,
      isActive: data.isActive !== false,
    };

    if (mongoose.connection.readyState === 1) {
      return await PostalCode.findOneAndUpdate(
        { pinCode: validation.normalizedPin },
        { $set: postalData },
        { new: true, upsert: true }
      );
    }

    const idx = memoryPostalCodes.findIndex((p) => p.pinCode === validation.normalizedPin);
    if (idx >= 0) {
      memoryPostalCodes[idx] = { ...memoryPostalCodes[idx], ...postalData, _id: memoryPostalCodes[idx]._id || `pc_${Date.now()}` };
      return memoryPostalCodes[idx];
    } else {
      const created = { ...postalData, _id: `pc_${Date.now()}` };
      memoryPostalCodes.push(created);
      return created;
    }
  }

  /**
   * Admin: Delete postal code record
   */
  static async deletePostalCode(idOrPin) {
    if (mongoose.connection.readyState === 1) {
      if (mongoose.Types.ObjectId.isValid(idOrPin)) {
        return await PostalCode.findByIdAndDelete(idOrPin);
      }
      return await PostalCode.findOneAndDelete({ pinCode: idOrPin });
    }

    const idx = memoryPostalCodes.findIndex(
      (p) => p._id === idOrPin || p.pinCode === idOrPin
    );
    if (idx >= 0) {
      const deleted = memoryPostalCodes[idx];
      memoryPostalCodes.splice(idx, 1);
      return deleted;
    }
    return null;
  }
}
