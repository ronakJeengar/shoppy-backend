import crypto from "crypto";
import mongoose from "mongoose";
import { AppConfig } from "../models/app_config.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAdminAction } from "../utils/auditLogger.js";

export const ALLOWED_HOME_SECTION_IDS = [
  "hero_banner",
  "categories",
  "trending",
  "recommendations",
  "featured_collection",
  "offers",
];

export const DEFAULT_APP_CONFIG = {
  configVersion: "2026.09.01.1",
  appVersion: {
    minimumSupported: "1.0.0",
    latestRecommended: "1.1.0",
    updateUrl: "https://shoppy.example.com/download",
  },
  maintenance: {
    enabled: false,
    message:
      "Shoppy is currently undergoing scheduled maintenance. Please check back shortly.",
  },
  features: {
    wishlist: true,
    reviews: true,
    productVideo: true,
    product3D: true,
    recommendations: true,
    aiAssistant: true,
    notifications: true,
    coupons: true,
    orderTracking: true,
  },
  media: {
    imageBaseUrl: "https://images.unsplash.com",
    videoEnabled: true,
    threeDEnabled: true,
    maxUploadSizeMb: 10,
  },
  commerce: {
    currency: "INR",
    currencySymbol: "₹",
    originState: process.env.STORE_ORIGIN_STATE || "KARNATAKA",
    supportedGstRates: [0, 5, 12, 18, 28],
    taxInclusive: true,
    supportedPaymentMethods: ["CARD", "UPI", "NET_BANKING", "WALLET", "COD"],
    supportedDeliveryMethods: ["STANDARD", "EXPRESS", "OVERNIGHT"],
  },
  ui: {
    homeSections: [
      { id: "hero_banner", name: "Hero Banner", enabled: true, order: 1 },
      { id: "categories", name: "Categories", enabled: true, order: 2 },
      { id: "trending", name: "Trending Now", enabled: true, order: 3 },
      {
        id: "recommendations",
        name: "Recommended For You",
        enabled: true,
        order: 4,
      },
      {
        id: "featured_collection",
        name: "Featured Products",
        enabled: true,
        order: 5,
      },
      { id: "offers", name: "Special Deals & Offers", enabled: true, order: 6 },
    ],
    showOffers: true,
    showRecommendations: true,
  },
  support: {
    contactEmail: "support@shoppy.com",
    supportUrl: "https://shoppy.example.com/support",
    termsUrl: "https://shoppy.example.com/terms",
    privacyUrl: "https://shoppy.example.com/privacy",
    helpUrl: "https://shoppy.example.com/help",
  },
};

// In-memory store for test and offline environments
export let memoryAppConfig = JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG));

export const _resetMemoryAppConfig = () => {
  memoryAppConfig = JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG));
};

/**
 * Compare two semver strings: major.minor.patch
 * Returns:
 *  -1 if v1 < v2
 *   0 if v1 === v2
 *   1 if v1 > v2
 */
export const compareSemver = (v1, v2) => {
  if (!v1 || !v2) return 0;
  const p1 = v1.toString().trim().replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = v2.toString().trim().replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);

  const length = Math.max(p1.length, p2.length, 3);
  for (let i = 0; i < length; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
};

/**
 * Fetch raw config from MongoDB or in-memory fallback
 */
const fetchRawConfig = async () => {
  if (mongoose.connection.readyState === 1) {
    let doc = await AppConfig.findOne({ configKey: "DEFAULT_CONFIG" }).lean();
    if (!doc) {
      doc = await AppConfig.create(DEFAULT_APP_CONFIG);
      return doc.toObject();
    }
    return doc;
  }
  return memoryAppConfig;
};

/**
 * Public Bootstrap API endpoint
 * GET /api/v1/app/bootstrap
 */
export const getAppBootstrap = asyncHandler(async (req, res) => {
  const rawConfig = await fetchRawConfig();

  // Extract client app version from headers or query parameters
  const clientVersion =
    req.headers["x-app-version"] ||
    req.query.clientVersion ||
    req.query.appVersion ||
    null;

  let forceUpdateRequired = false;
  let optionalUpdateAvailable = false;

  if (clientVersion && typeof clientVersion === "string") {
    const minVersion = rawConfig.appVersion?.minimumSupported || "1.0.0";
    const recVersion = rawConfig.appVersion?.latestRecommended || "1.0.0";

    forceUpdateRequired = compareSemver(clientVersion, minVersion) < 0;
    optionalUpdateAvailable =
      !forceUpdateRequired && compareSemver(clientVersion, recVersion) < 0;
  }

  // Assemble safe client-facing payload (strictly no server secrets)
  const clientConfig = {
    configVersion: rawConfig.configVersion,
    environment: process.env.NODE_ENV || "development",
    appVersion: {
      minimumSupported: rawConfig.appVersion?.minimumSupported || "1.0.0",
      latestRecommended: rawConfig.appVersion?.latestRecommended || "1.0.0",
      updateUrl:
        rawConfig.appVersion?.updateUrl || "https://shoppy.example.com/download",
      forceUpdateRequired,
      optionalUpdateAvailable,
    },
    maintenance: {
      enabled: Boolean(rawConfig.maintenance?.enabled),
      message:
        rawConfig.maintenance?.message ||
        "Shoppy is currently undergoing scheduled maintenance.",
    },
    features: {
      wishlist: Boolean(rawConfig.features?.wishlist),
      reviews: Boolean(rawConfig.features?.reviews),
      productVideo: Boolean(rawConfig.features?.productVideo),
      product3D: Boolean(rawConfig.features?.product3D),
      recommendations: Boolean(rawConfig.features?.recommendations),
      aiAssistant: Boolean(rawConfig.features?.aiAssistant),
      notifications: Boolean(rawConfig.features?.notifications),
      coupons: Boolean(rawConfig.features?.coupons),
      orderTracking: Boolean(rawConfig.features?.orderTracking),
    },
    media: {
      imageBaseUrl: rawConfig.media?.imageBaseUrl || "https://images.unsplash.com",
      videoEnabled: Boolean(rawConfig.media?.videoEnabled),
      threeDEnabled: Boolean(rawConfig.media?.threeDEnabled),
      maxUploadSizeMb: Number(rawConfig.media?.maxUploadSizeMb) || 10,
    },
    commerce: {
      currency: rawConfig.commerce?.currency || "INR",
      currencySymbol: rawConfig.commerce?.currencySymbol || "₹",
      originState:
        rawConfig.commerce?.originState ||
        process.env.STORE_ORIGIN_STATE ||
        "KARNATAKA",
      supportedGstRates: rawConfig.commerce?.supportedGstRates || [
        0, 5, 12, 18, 28,
      ],
      taxInclusive:
        rawConfig.commerce?.taxInclusive !== undefined
          ? Boolean(rawConfig.commerce.taxInclusive)
          : true,
      supportedPaymentMethods:
        rawConfig.commerce?.supportedPaymentMethods || [
          "CARD",
          "UPI",
          "NET_BANKING",
          "WALLET",
          "COD",
        ],
      supportedDeliveryMethods:
        rawConfig.commerce?.supportedDeliveryMethods || [
          "STANDARD",
          "EXPRESS",
          "OVERNIGHT",
        ],
    },
    ui: {
      homeSections: (rawConfig.ui?.homeSections || []).sort(
        (a, b) => a.order - b.order
      ),
      showOffers: Boolean(rawConfig.ui?.showOffers),
      showRecommendations: Boolean(rawConfig.ui?.showRecommendations),
    },
    support: {
      contactEmail: rawConfig.support?.contactEmail || "support@shoppy.com",
      supportUrl:
        rawConfig.support?.supportUrl || "https://shoppy.example.com/support",
      termsUrl:
        rawConfig.support?.termsUrl || "https://shoppy.example.com/terms",
      privacyUrl:
        rawConfig.support?.privacyUrl || "https://shoppy.example.com/privacy",
      helpUrl: rawConfig.support?.helpUrl || "https://shoppy.example.com/help",
    },
    serverTime: new Date().toISOString(),
  };

  // Generate deterministic ETag based on configuration payload (excluding volatile serverTime)
  const hashPayload = {
    configVersion: rawConfig.configVersion,
    appVersion: clientConfig.appVersion,
    maintenance: clientConfig.maintenance,
    features: clientConfig.features,
    media: clientConfig.media,
    commerce: clientConfig.commerce,
    ui: clientConfig.ui,
    support: clientConfig.support,
  };
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(hashPayload))
    .digest("hex")
    .substring(0, 16);
  const etag = `W/"shoppy-cfg-${clientConfig.configVersion}-${hash}"`;

  // Check conditional request If-None-Match
  const clientEtag = req.headers["if-none-match"];
  if (clientEtag && clientEtag === etag) {
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.status(304).end();
  }

  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  return res.status(200).json(
    new ApiResponse(
      200,
      clientConfig,
      "App bootstrap configuration retrieved successfully"
    )
  );
});

/**
 * Admin Get App Config
 * GET /api/v1/admin/config
 */
export const getAdminAppConfig = asyncHandler(async (req, res) => {
  const config = await fetchRawConfig();
  return res.status(200).json(
    new ApiResponse(200, config, "Admin configuration retrieved successfully")
  );
});

/**
 * Admin Update App Config
 * PATCH /api/v1/admin/config
 */
export const updateAdminAppConfig = asyncHandler(async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
    throw new ApiError(400, "Update payload cannot be empty");
  }

  // Prevent forbidden keys (never allow credentials or internal state injection)
  const FORBIDDEN_FIELDS = [
    "_id",
    "createdAt",
    "updatedAt",
    "password",
    "secret",
    "token",
    "apiKey",
    "dbUri",
  ];
  for (const field of FORBIDDEN_FIELDS) {
    if (field in updates) {
      throw new ApiError(400, `Modifying forbidden property '${field}' is not allowed`);
    }
  }

  // Validate homeSections if provided
  if (updates.ui?.homeSections) {
    if (!Array.isArray(updates.ui.homeSections)) {
      throw new ApiError(400, "ui.homeSections must be an array");
    }
    for (const section of updates.ui.homeSections) {
      if (!section.id || !ALLOWED_HOME_SECTION_IDS.includes(section.id)) {
        throw new ApiError(
          400,
          `Invalid section id '${section.id}'. Allowed sections: ${ALLOWED_HOME_SECTION_IDS.join(", ")}`
        );
      }
      if (typeof section.enabled !== "boolean") {
        throw new ApiError(400, `Section '${section.id}' enabled must be a boolean`);
      }
      if (typeof section.order !== "number") {
        throw new ApiError(400, `Section '${section.id}' order must be a number`);
      }
    }
  }

  // Validate feature flags if provided
  if (updates.features) {
    if (typeof updates.features !== "object") {
      throw new ApiError(400, "features must be an object of boolean flags");
    }
    for (const [key, value] of Object.entries(updates.features)) {
      if (typeof value !== "boolean") {
        throw new ApiError(400, `Feature flag '${key}' must be a boolean value`);
      }
    }
  }

  // Validate semver app versions if provided
  const semverRegex = /^\d+\.\d+\.\d+$/;
  if (updates.appVersion?.minimumSupported) {
    if (!semverRegex.test(updates.appVersion.minimumSupported)) {
      throw new ApiError(
        400,
        "appVersion.minimumSupported must follow semver format X.Y.Z"
      );
    }
  }
  if (updates.appVersion?.latestRecommended) {
    if (!semverRegex.test(updates.appVersion.latestRecommended)) {
      throw new ApiError(
        400,
        "appVersion.latestRecommended must follow semver format X.Y.Z"
      );
    }
  }

  // Auto-increment config version timestamp
  const newConfigVersion = `${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}.${Date.now().toString().slice(-4)}`;

  let updatedDoc;
  if (mongoose.connection.readyState === 1) {
    const existing = await AppConfig.findOne({ configKey: "DEFAULT_CONFIG" });
    if (existing) {
      if (updates.features) existing.features = { ...existing.features.toObject(), ...updates.features };
      if (updates.appVersion) existing.appVersion = { ...existing.appVersion.toObject(), ...updates.appVersion };
      if (updates.maintenance) existing.maintenance = { ...existing.maintenance.toObject(), ...updates.maintenance };
      if (updates.media) existing.media = { ...existing.media.toObject(), ...updates.media };
      if (updates.commerce) existing.commerce = { ...existing.commerce.toObject(), ...updates.commerce };
      if (updates.ui) existing.ui = { ...existing.ui.toObject(), ...updates.ui };
      if (updates.support) existing.support = { ...existing.support.toObject(), ...updates.support };
      existing.configVersion = updates.configVersion || newConfigVersion;

      await existing.save();
      updatedDoc = existing.toObject();
    } else {
      updatedDoc = await AppConfig.create({
        ...DEFAULT_APP_CONFIG,
        ...updates,
        configVersion: updates.configVersion || newConfigVersion,
      });
      updatedDoc = updatedDoc.toObject();
    }
  } else {
    // In-memory update
    if (updates.features) memoryAppConfig.features = { ...memoryAppConfig.features, ...updates.features };
    if (updates.appVersion) memoryAppConfig.appVersion = { ...memoryAppConfig.appVersion, ...updates.appVersion };
    if (updates.maintenance) memoryAppConfig.maintenance = { ...memoryAppConfig.maintenance, ...updates.maintenance };
    if (updates.media) memoryAppConfig.media = { ...memoryAppConfig.media, ...updates.media };
    if (updates.commerce) memoryAppConfig.commerce = { ...memoryAppConfig.commerce, ...updates.commerce };
    if (updates.ui) memoryAppConfig.ui = { ...memoryAppConfig.ui, ...updates.ui };
    if (updates.support) memoryAppConfig.support = { ...memoryAppConfig.support, ...updates.support };
    memoryAppConfig.configVersion = updates.configVersion || newConfigVersion;

    updatedDoc = memoryAppConfig;
  }

  // Audit log admin configuration change
  await logAdminAction({
    req,
    action: "UPDATE_APP_CONFIG",
    resourceType: "SYSTEM",
    resourceId: "APP_CONFIG",
    details: {
      updatedFields: Object.keys(updates),
      newConfigVersion: updatedDoc.configVersion,
    },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      updatedDoc,
      "Application configuration updated successfully"
    )
  );
});
