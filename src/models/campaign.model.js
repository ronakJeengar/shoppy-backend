import mongoose, { Schema } from "mongoose";

export const ALLOWED_CAMPAIGN_TYPES = [
  "SALE",
  "FESTIVAL",
  "CATEGORY",
  "PRODUCT",
  "NEW_ARRIVAL",
  "BANK_OFFER",
  "SEASONAL",
  "GENERAL",
];

export const ALLOWED_TARGET_TYPES = [
  "HOME",
  "CATEGORY",
  "PRODUCT",
  "SEARCH",
  "COUPON",
  "COLLECTION",
];

const campaignSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Campaign title is required"],
      trim: true,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    bannerImage: {
      type: String,
      required: [true, "Banner image is required"],
      trim: true,
    },
    mobileImage: {
      type: String,
      default: "",
      trim: true,
    },
    desktopImage: {
      type: String,
      default: "",
      trim: true,
    },
    campaignType: {
      type: String,
      enum: ALLOWED_CAMPAIGN_TYPES,
      default: "GENERAL",
      index: true,
    },
    startAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endAt: {
      type: Date,
      required: [true, "Campaign end date is required"],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    targetType: {
      type: String,
      enum: ALLOWED_TARGET_TYPES,
      default: "HOME",
    },
    targetId: {
      type: String,
      default: "",
      trim: true,
    },
    ctaLabel: {
      type: String,
      default: "Shop Now",
      trim: true,
    },
    ctaAction: {
      type: {
        type: String,
        enum: ALLOWED_TARGET_TYPES,
        default: "HOME",
      },
      value: {
        type: String,
        default: "",
        trim: true,
      },
    },
    couponCode: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save validation for schedule ordering
campaignSchema.pre("validate", function (next) {
  if (this.startAt && this.endAt && new Date(this.endAt) <= new Date(this.startAt)) {
    this.invalidate("endAt", "Campaign endAt must be strictly greater than startAt");
  }

  // Ensure ctaAction stays in sync with targetType/targetId if not explicitly specified
  if (!this.ctaAction || !this.ctaAction.type) {
    this.ctaAction = {
      type: this.targetType || "HOME",
      value: this.targetId || "",
    };
  } else if (this.targetType && (!this.ctaAction.type || this.ctaAction.type === "HOME")) {
    this.ctaAction.type = this.targetType;
    this.ctaAction.value = this.targetId || this.ctaAction.value || "";
  }

  next();
});

// Compound index for high-performance active campaign discovery
campaignSchema.index({
  isActive: 1,
  startAt: 1,
  endAt: 1,
  priority: -1,
  displayOrder: 1,
});

export const Campaign = mongoose.model("Campaign", campaignSchema);
