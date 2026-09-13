import mongoose, { Schema } from "mongoose";

const homeSectionSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const appConfigSchema = new Schema(
  {
    configKey: {
      type: String,
      required: true,
      unique: true,
      default: "DEFAULT_CONFIG",
      index: true,
    },
    configVersion: {
      type: String,
      required: true,
      default: "2026.09.01.1",
    },
    appVersion: {
      minimumSupported: { type: String, default: "1.0.0" },
      latestRecommended: { type: String, default: "1.1.0" },
      updateUrl: {
        type: String,
        default: "https://shoppy.example.com/download",
      },
    },
    maintenance: {
      enabled: { type: Boolean, default: false },
      message: {
        type: String,
        default:
          "Shoppy is currently undergoing scheduled maintenance. Please check back shortly.",
      },
    },
    features: {
      wishlist: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
      productVideo: { type: Boolean, default: true },
      product3D: { type: Boolean, default: true },
      recommendations: { type: Boolean, default: true },
      aiAssistant: { type: Boolean, default: true },
      notifications: { type: Boolean, default: true },
      coupons: { type: Boolean, default: true },
      orderTracking: { type: Boolean, default: true },
    },
    media: {
      imageBaseUrl: { type: String, default: "https://images.unsplash.com" },
      videoEnabled: { type: Boolean, default: true },
      threeDEnabled: { type: Boolean, default: true },
      maxUploadSizeMb: { type: Number, default: 10 },
    },
    commerce: {
      currency: { type: String, default: "INR" },
      currencySymbol: { type: String, default: "₹" },
      originState: { type: String, default: "KARNATAKA" },
      supportedGstRates: {
        type: [Number],
        default: [0, 5, 12, 18, 28],
      },
      taxInclusive: { type: Boolean, default: true },
      supportedPaymentMethods: {
        type: [String],
        default: ["CARD", "UPI", "NET_BANKING", "WALLET", "COD"],
      },
      supportedDeliveryMethods: {
        type: [String],
        default: ["STANDARD", "EXPRESS", "OVERNIGHT"],
      },
      shipping: {
        freeShippingThreshold: { type: Number, default: 999 },
        defaultShippingFee: { type: Number, default: 49 },
        expressShippingFee: { type: Number, default: 99 },
        remoteShippingSurcharge: { type: Number, default: 50 },
        standardDeliveryMinDays: { type: Number, default: 3 },
        standardDeliveryMaxDays: { type: Number, default: 5 },
        expressDeliveryMinDays: { type: Number, default: 1 },
        expressDeliveryMaxDays: { type: Number, default: 2 },
      },
      cod: {
        enabled: { type: Boolean, default: true },
        minOrderValue: { type: Number, default: 299 },
        maxOrderValue: { type: Number, default: 50000 },
        fee: { type: Number, default: 40 },
        freeAboveAmount: { type: Number, default: 1499 },
        eligibleShippingZones: {
          type: [String],
          default: ["LOCAL", "REGIONAL", "NATIONAL"],
        },
        eligibleStates: {
          type: [String],
          default: [],
        },
        eligiblePinCodes: {
          type: [String],
          default: [],
        },
        maxItems: { type: Number, default: 10 },
        firstOrderAllowed: { type: Boolean, default: true },
        guestAllowed: { type: Boolean, default: false },
      },
      seller: {
        legalName: { type: String, default: "Shoppy E-Commerce Private Limited" },
        tradeName: { type: String, default: "Shoppy India" },
        address: { type: String, default: "Block B, 4th Floor, Tech Park, Indiranagar" },
        city: { type: String, default: "Bengaluru" },
        district: { type: String, default: "Bengaluru Urban" },
        state: { type: String, default: "Karnataka" },
        stateCode: { type: String, default: "KA" },
        pinCode: { type: String, default: "560038" },
        country: { type: String, default: "India" },
        gstin: { type: String, default: "29AABCU9603R1ZM" },
        pan: { type: String, default: "AABCU9603R" },
        phone: { type: String, default: "+91 80 4567 8900" },
        email: { type: String, default: "billing@shoppy.in" },
        cin: { type: String, default: "U72900KA2024PTC123456" },
      },
    },
    ui: {
      homeSections: {
        type: [homeSectionSchema],
        default: [
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
      },
      showOffers: { type: Boolean, default: true },
      showRecommendations: { type: Boolean, default: true },
    },
    support: {
      contactEmail: { type: String, default: "support@shoppy.com" },
      supportUrl: { type: String, default: "https://shoppy.example.com/support" },
      termsUrl: { type: String, default: "https://shoppy.example.com/terms" },
      privacyUrl: { type: String, default: "https://shoppy.example.com/privacy" },
      helpUrl: { type: String, default: "https://shoppy.example.com/help" },
    },
  },
  {
    timestamps: true,
  }
);

export const AppConfig = mongoose.model("AppConfig", appConfigSchema);
