import mongoose from "mongoose";
import {
  Campaign,
  ALLOWED_CAMPAIGN_TYPES,
  ALLOWED_TARGET_TYPES,
} from "../models/campaign.model.js";
import { ApiError } from "../utils/apiError.js";

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

export const memoryCampaigns = [
  {
    _id: "camp_diwali_sale",
    title: "Diwali Dhamaka Sale — Up to 50% Off",
    subtitle: "Celebrate festive joy with mega savings on top electronics and fashion",
    description: "Exclusive festive discounts, instant bank offers, and limited-time coupons on premium brands.",
    bannerImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200&auto=format&fit=crop&q=80",
    mobileImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600&auto=format&fit=crop&q=80",
    desktopImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200&auto=format&fit=crop&q=80",
    campaignType: "FESTIVAL",
    startAt: new Date(now - 2 * DAY),
    endAt: new Date(now + 14 * DAY),
    isActive: true,
    priority: 10,
    displayOrder: 1,
    targetType: "CATEGORY",
    targetId: "electronics",
    ctaLabel: "Shop Festive Sale",
    ctaAction: {
      type: "CATEGORY",
      value: "electronics",
    },
    couponCode: "FESTIVE20",
    metadata: {
      tag: "FESTIVAL SPECIAL",
      bgGradient: "amber",
      accentColor: "#F59E0B",
    },
  },
  {
    _id: "camp_audio_tech",
    title: "Next-Gen Sound & Audio Labs",
    subtitle: "Explore noise-cancelling headphones, soundbars & studio gear",
    description: "State-of-the-art acoustics and high-fidelity audio equipment with official brand warranties.",
    bannerImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80",
    mobileImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
    desktopImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80",
    campaignType: "NEW_ARRIVAL",
    startAt: new Date(now - 5 * DAY),
    endAt: new Date(now + 25 * DAY),
    isActive: true,
    priority: 8,
    displayOrder: 2,
    targetType: "CATEGORY",
    targetId: "audio-acoustics",
    ctaLabel: "Explore Audio",
    ctaAction: {
      type: "CATEGORY",
      value: "audio-acoustics",
    },
    couponCode: null,
    metadata: {
      tag: "NEW ARRIVALS",
      bgGradient: "indigo",
      accentColor: "#4F46E5",
    },
  },
  {
    _id: "camp_home_kitchen",
    title: "Modern Living & Artisan Home",
    subtitle: "Elevate your space with handcrafted cookware & designer accents",
    description: "Curated collection of modern kitchenware, ergonomic dining pieces, and artisan ceramics.",
    bannerImage: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&auto=format&fit=crop&q=80",
    mobileImage: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80",
    desktopImage: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&auto=format&fit=crop&q=80",
    campaignType: "SALE",
    startAt: new Date(now - 1 * DAY),
    endAt: new Date(now + 20 * DAY),
    isActive: true,
    priority: 5,
    displayOrder: 3,
    targetType: "COUPON",
    targetId: "FLAT500",
    ctaLabel: "Use FLAT500",
    ctaAction: {
      type: "COUPON",
      value: "FLAT500",
    },
    couponCode: "FLAT500",
    metadata: {
      tag: "LIMITED OFFER",
      bgGradient: "slate",
      accentColor: "#0F172A",
    },
  },
  {
    _id: "camp_expired_clearance",
    title: "Monsoon Clearance Blowout",
    subtitle: "Past promotional offer archive",
    description: "Expired promotional sale testing schedule validity.",
    bannerImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
    mobileImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&auto=format&fit=crop&q=80",
    desktopImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
    campaignType: "SEASONAL",
    startAt: new Date(now - 60 * DAY),
    endAt: new Date(now - 10 * DAY),
    isActive: true,
    priority: 1,
    displayOrder: 4,
    targetType: "CATEGORY",
    targetId: "fashion-apparel",
    ctaLabel: "View Clearance",
    ctaAction: {
      type: "CATEGORY",
      value: "fashion-apparel",
    },
    couponCode: null,
    metadata: {
      tag: "EXPIRED",
      bgGradient: "slate",
    },
  },
  {
    _id: "camp_scheduled_republic",
    title: "Republic Day Mega Sale Sneak Peek",
    subtitle: "Great Indian patriotic sale preview",
    description: "Future scheduled campaign testing upcoming scheduling.",
    bannerImage: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&auto=format&fit=crop&q=80",
    mobileImage: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80",
    desktopImage: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&auto=format&fit=crop&q=80",
    campaignType: "FESTIVAL",
    startAt: new Date(now + 10 * DAY),
    endAt: new Date(now + 30 * DAY),
    isActive: true,
    priority: 15,
    displayOrder: 1,
    targetType: "HOME",
    targetId: "",
    ctaLabel: "Notify Me",
    ctaAction: {
      type: "HOME",
      value: "",
    },
    couponCode: null,
    metadata: {
      tag: "UPCOMING",
      bgGradient: "amber",
    },
  },
  {
    _id: "camp_inactive_test",
    title: "Disabled Campaign Test",
    subtitle: "Manually turned off campaign",
    description: "Test inactive campaign status filtering.",
    bannerImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
    mobileImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&auto=format&fit=crop&q=80",
    desktopImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
    campaignType: "GENERAL",
    startAt: new Date(now - 5 * DAY),
    endAt: new Date(now + 15 * DAY),
    isActive: false,
    priority: 2,
    displayOrder: 5,
    targetType: "HOME",
    targetId: "",
    ctaLabel: "Learn More",
    ctaAction: {
      type: "HOME",
      value: "",
    },
    couponCode: null,
    metadata: {},
  },
];

export class CampaignService {
  /**
   * Formats a raw Mongo document or in-memory campaign object into a standardized API payload.
   */
  static formatCampaign(doc) {
    if (!doc) return null;
    const id = (doc._id || doc.id || "").toString();
    const targetType = doc.targetType || "HOME";
    const targetId = doc.targetId || "";

    const ctaAction = doc.ctaAction && doc.ctaAction.type
      ? {
          type: doc.ctaAction.type,
          value: doc.ctaAction.value || targetId,
        }
      : {
          type: targetType,
          value: targetId,
        };

    return {
      id,
      title: doc.title,
      subtitle: doc.subtitle || "",
      description: doc.description || "",
      bannerImage: doc.bannerImage,
      mobileImage: doc.mobileImage || doc.bannerImage,
      desktopImage: doc.desktopImage || doc.bannerImage,
      campaignType: doc.campaignType || "GENERAL",
      startAt: doc.startAt ? new Date(doc.startAt).toISOString() : new Date().toISOString(),
      endAt: doc.endAt ? new Date(doc.endAt).toISOString() : new Date().toISOString(),
      isActive: doc.isActive !== false,
      priority: doc.priority || 0,
      displayOrder: doc.displayOrder || 0,
      targetType,
      targetId,
      ctaLabel: doc.ctaLabel || "Shop Now",
      ctaAction,
      couponCode: doc.couponCode || null,
      metadata: doc.metadata || {},
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Retrieves currently active campaigns. Authoritatively evaluated on the backend:
   * 1. isActive === true
   * 2. startAt <= now <= endAt
   * 3. Deterministically sorted by priority DESC, displayOrder ASC, createdAt DESC
   */
  static async getActiveCampaigns({ now = new Date(), limit = 10, campaignType } = {}) {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      try {
        const query = {
          isActive: true,
          startAt: { $lte: now },
          endAt: { $gte: now },
        };

        if (campaignType && ALLOWED_CAMPAIGN_TYPES.includes(campaignType)) {
          query.campaignType = campaignType;
        }

        const campaigns = await Campaign.find(query)
          .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
          .limit(limit)
          .lean();

        if (campaigns && campaigns.length > 0) {
          return campaigns.map(this.formatCampaign);
        }
      } catch (err) {
        console.warn("MongoDB campaign fetch failed, falling back to memory:", err.message);
      }
    }

    // Fallback in-memory filter
    const filtered = memoryCampaigns.filter((c) => {
      if (!c.isActive) return false;
      const s = new Date(c.startAt);
      const e = new Date(c.endAt);
      if (s > now || e < now) return false;
      if (campaignType && c.campaignType !== campaignType) return false;
      return true;
    });

    // Deterministic sort: priority DESC, displayOrder ASC
    filtered.sort((a, b) => {
      if (b.priority !== a.priority) {
        return (b.priority || 0) - (a.priority || 0);
      }
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });

    return filtered.slice(0, limit).map(this.formatCampaign);
  }

  /**
   * Admin: List all campaigns with pagination, status filters, and search.
   */
  static async listCampaigns({
    page = 1,
    limit = 20,
    status = "all",
    campaignType,
    search,
  } = {}) {
    const now = new Date();
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const query = {};

      if (status === "active") {
        query.isActive = true;
        query.startAt = { $lte: now };
        query.endAt = { $gte: now };
      } else if (status === "inactive") {
        query.isActive = false;
      } else if (status === "expired") {
        query.endAt = { $lt: now };
      } else if (status === "scheduled") {
        query.startAt = { $gt: now };
      }

      if (campaignType && ALLOWED_CAMPAIGN_TYPES.includes(campaignType)) {
        query.campaignType = campaignType;
      }

      if (search && search.trim()) {
        query.$or = [
          { title: { $regex: search.trim(), $options: "i" } },
          { subtitle: { $regex: search.trim(), $options: "i" } },
          { couponCode: { $regex: search.trim(), $options: "i" } },
        ];
      }

      const skip = (page - 1) * limit;
      const [total, docs] = await Promise.all([
        Campaign.countDocuments(query),
        Campaign.find(query)
          .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      return {
        items: docs.map(this.formatCampaign),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      };
    }

    // In-memory fallback
    let items = [...memoryCampaigns];

    if (status === "active") {
      items = items.filter(
        (c) => c.isActive && new Date(c.startAt) <= now && new Date(c.endAt) >= now
      );
    } else if (status === "inactive") {
      items = items.filter((c) => !c.isActive);
    } else if (status === "expired") {
      items = items.filter((c) => new Date(c.endAt) < now);
    } else if (status === "scheduled") {
      items = items.filter((c) => new Date(c.startAt) > now);
    }

    if (campaignType) {
      items = items.filter((c) => c.campaignType === campaignType);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
          (c.couponCode && c.couponCode.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => {
      if (b.priority !== a.priority) return (b.priority || 0) - (a.priority || 0);
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });

    const total = items.length;
    const skip = (page - 1) * limit;
    const paginated = items.slice(skip, skip + limit);

    return {
      items: paginated.map(this.formatCampaign),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single campaign by ID.
   */
  static async getCampaignById(id) {
    if (!id) throw new ApiError(400, "Campaign ID is required");

    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected && mongoose.isValidObjectId(id)) {
      const campaign = await Campaign.findById(id).lean();
      if (campaign) return this.formatCampaign(campaign);
    }

    const mem = memoryCampaigns.find((c) => c._id === id || c.id === id);
    if (!mem) throw new ApiError(404, `Campaign with ID ${id} not found`);
    return this.formatCampaign(mem);
  }

  /**
   * Admin: Creates a new campaign with strict validation.
   */
  static async createCampaign(payload) {
    const {
      title,
      subtitle,
      description,
      bannerImage,
      mobileImage,
      desktopImage,
      campaignType = "GENERAL",
      startAt = new Date(),
      endAt,
      isActive = true,
      priority = 0,
      displayOrder = 0,
      targetType = "HOME",
      targetId = "",
      ctaLabel = "Shop Now",
      ctaAction,
      couponCode,
      metadata,
    } = payload;

    if (!title || !title.trim()) {
      throw new ApiError(400, "Campaign title is required");
    }

    if (!bannerImage || !bannerImage.trim()) {
      throw new ApiError(400, "Banner image URL is required");
    }

    if (!endAt) {
      throw new ApiError(400, "Campaign end date (endAt) is required");
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ApiError(400, "Invalid startAt or endAt date format");
    }

    if (endDate <= startDate) {
      throw new ApiError(400, "Campaign endAt must be strictly greater than startAt");
    }

    if (!ALLOWED_CAMPAIGN_TYPES.includes(campaignType)) {
      throw new ApiError(
        400,
        `Invalid campaignType. Allowed: ${ALLOWED_CAMPAIGN_TYPES.join(", ")}`
      );
    }

    if (targetType && !ALLOWED_TARGET_TYPES.includes(targetType)) {
      throw new ApiError(
        400,
        `Invalid targetType. Allowed: ${ALLOWED_TARGET_TYPES.join(", ")}`
      );
    }

    const resolvedCtaAction = ctaAction && ctaAction.type
      ? {
          type: ALLOWED_TARGET_TYPES.includes(ctaAction.type) ? ctaAction.type : targetType,
          value: ctaAction.value || targetId || "",
        }
      : {
          type: targetType || "HOME",
          value: targetId || "",
        };

    const campaignData = {
      title: title.trim(),
      subtitle: subtitle ? subtitle.trim() : "",
      description: description ? description.trim() : "",
      bannerImage: bannerImage.trim(),
      mobileImage: mobileImage ? mobileImage.trim() : bannerImage.trim(),
      desktopImage: desktopImage ? desktopImage.trim() : bannerImage.trim(),
      campaignType,
      startAt: startDate,
      endAt: endDate,
      isActive: Boolean(isActive),
      priority: Number(priority) || 0,
      displayOrder: Number(displayOrder) || 0,
      targetType,
      targetId: targetId ? targetId.trim() : "",
      ctaLabel: ctaLabel ? ctaLabel.trim() : "Shop Now",
      ctaAction: resolvedCtaAction,
      couponCode: couponCode ? couponCode.trim().toUpperCase() : null,
      metadata: metadata || {},
    };

    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected) {
      const created = await Campaign.create(campaignData);
      return this.formatCampaign(created);
    }

    // Memory storage
    const newDoc = {
      _id: `camp_${Date.now()}`,
      ...campaignData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryCampaigns.unshift(newDoc);
    return this.formatCampaign(newDoc);
  }

  /**
   * Admin: Updates an existing campaign.
   */
  static async updateCampaign(id, updateData) {
    if (!id) throw new ApiError(400, "Campaign ID is required");

    const campaign = await this.getCampaignById(id);

    const startDate = updateData.startAt
      ? new Date(updateData.startAt)
      : new Date(campaign.startAt);
    const endDate = updateData.endAt
      ? new Date(updateData.endAt)
      : new Date(campaign.endAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ApiError(400, "Invalid startAt or endAt date format");
    }

    if (endDate <= startDate) {
      throw new ApiError(400, "Campaign endAt must be strictly greater than startAt");
    }

    if (
      updateData.campaignType &&
      !ALLOWED_CAMPAIGN_TYPES.includes(updateData.campaignType)
    ) {
      throw new ApiError(
        400,
        `Invalid campaignType. Allowed: ${ALLOWED_CAMPAIGN_TYPES.join(", ")}`
      );
    }

    if (
      updateData.targetType &&
      !ALLOWED_TARGET_TYPES.includes(updateData.targetType)
    ) {
      throw new ApiError(
        400,
        `Invalid targetType. Allowed: ${ALLOWED_TARGET_TYPES.join(", ")}`
      );
    }

    if (updateData.couponCode) {
      updateData.couponCode = updateData.couponCode.trim().toUpperCase();
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected && mongoose.isValidObjectId(id)) {
      const updated = await Campaign.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();
      if (updated) return this.formatCampaign(updated);
    }

    const memIdx = memoryCampaigns.findIndex((c) => c._id === id || c.id === id);
    if (memIdx !== -1) {
      memoryCampaigns[memIdx] = {
        ...memoryCampaigns[memIdx],
        ...updateData,
        updatedAt: new Date(),
      };
      return this.formatCampaign(memoryCampaigns[memIdx]);
    }

    throw new ApiError(404, `Campaign ${id} not found`);
  }

  /**
   * Admin: Toggles campaign active status.
   */
  static async toggleCampaignStatus(id, isActive) {
    if (typeof isActive !== "boolean") {
      throw new ApiError(400, "isActive boolean value is required");
    }
    return this.updateCampaign(id, { isActive });
  }

  /**
   * Admin: Deletes a campaign.
   */
  static async deleteCampaign(id) {
    if (!id) throw new ApiError(400, "Campaign ID is required");

    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected && mongoose.isValidObjectId(id)) {
      const deleted = await Campaign.findByIdAndDelete(id).lean();
      if (deleted) return true;
    }

    const memIdx = memoryCampaigns.findIndex((c) => c._id === id || c.id === id);
    if (memIdx !== -1) {
      memoryCampaigns.splice(memIdx, 1);
      return true;
    }

    throw new ApiError(404, `Campaign ${id} not found`);
  }
}
