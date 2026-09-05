import mongoose from "mongoose";
import { InteractionEvent } from "../../models/interaction_event.model.js";
import { User } from "../../models/user.model.js";

// In-memory store for unit tests or offline environments
export const memoryInteractionEvents = [];
export const memoryUserRecentlyViewed = new Map(); // userId -> string[]

export class InteractionService {
  /**
   * Records a user interaction event.
   * Fire-and-forget safe: never throws to prevent breaking core shopping workflows.
   */
  async recordEvent({
    userId = null,
    sessionId = null,
    eventType,
    productId,
    categoryId = null,
    metadata = {},
  }) {
    if (!eventType || !productId) return null;

    const prodIdStr = String(productId);
    const userIdStr = userId ? String(userId) : null;
    const now = new Date();

    const eventRecord = {
      user: userIdStr,
      sessionId: sessionId || (userIdStr ? null : "anon_sess"),
      eventType,
      product: prodIdStr,
      category: categoryId ? String(categoryId) : null,
      metadata,
      timestamp: now,
      createdAt: now,
    };

    // 1. Maintain in-memory tracking
    memoryInteractionEvents.unshift(eventRecord);
    if (memoryInteractionEvents.length > 500) {
      memoryInteractionEvents.pop();
    }

    // 2. Update recently viewed for authenticated users
    if (userIdStr && eventType === "VIEW_PRODUCT") {
      this._updateMemoryRecentlyViewed(userIdStr, prodIdStr);
    }

    // 3. Persist to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await InteractionEvent.create({
          user: userId || undefined,
          sessionId: sessionId || undefined,
          eventType,
          product: productId,
          category: categoryId || undefined,
          metadata: metadata instanceof Map ? metadata : new Map(Object.entries(metadata || {})),
          timestamp: now,
        });

        if (userId && eventType === "VIEW_PRODUCT") {
          // Efficient atomic update: pull duplicate then push to front and slice to 20
          await User.findByIdAndUpdate(userId, {
            $pull: { recentlyViewed: productId },
          });
          await User.findByIdAndUpdate(userId, {
            $push: {
              recentlyViewed: {
                $each: [productId],
                $position: 0,
                $slice: 20,
              },
            },
          });
        }
      } catch (err) {
        // Non-blocking catch to ensure recommendation tracking never crashes transactions
        console.warn("InteractionService.recordEvent: Failed to persist to Mongo:", err.message);
      }
    }

    return eventRecord;
  }

  _updateMemoryRecentlyViewed(userId, productId) {
    const list = memoryUserRecentlyViewed.get(userId) || [];
    const filtered = list.filter((id) => id !== productId);
    filtered.unshift(productId);
    if (filtered.length > 20) filtered.pop();
    memoryUserRecentlyViewed.set(userId, filtered);
  }

  /**
   * Retrieves recent interaction events for a user within a time window.
   */
  async getUserInteractions(userId, { limit = 50, days = 30 } = {}) {
    if (!userId) return [];
    const userIdStr = String(userId);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    if (mongoose.connection.readyState === 1) {
      try {
        return await InteractionEvent.find({
          user: userId,
          createdAt: { $gte: cutoff },
        })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
      } catch (err) {
        console.warn("InteractionService.getUserInteractions failed:", err.message);
      }
    }

    return memoryInteractionEvents
      .filter((e) => e.user === userIdStr && e.createdAt >= cutoff)
      .slice(0, limit);
  }

  /**
   * Retrieves user's recently viewed product IDs.
   */
  async getUserRecentlyViewed(userId, { limit = 10 } = {}) {
    if (!userId) return [];
    const userIdStr = String(userId);

    if (mongoose.connection.readyState === 1) {
      try {
        const userDoc = await User.findById(userId).select("recentlyViewed").lean();
        if (userDoc?.recentlyViewed?.length > 0) {
          return userDoc.recentlyViewed.slice(0, limit).map((id) => String(id));
        }
      } catch (err) {
        console.warn("InteractionService.getUserRecentlyViewed failed:", err.message);
      }
    }

    const memoryList = memoryUserRecentlyViewed.get(userIdStr) || [];
    if (memoryList.length > 0) {
      return memoryList.slice(0, limit);
    }

    // Fallback to interaction events
    return memoryInteractionEvents
      .filter((e) => e.user === userIdStr && e.eventType === "VIEW_PRODUCT")
      .map((e) => e.product)
      .filter((id, idx, self) => self.indexOf(id) === idx)
      .slice(0, limit);
  }

  /**
   * Clears in-memory stores (used in test suites).
   */
  clearMemory() {
    memoryInteractionEvents.length = 0;
    memoryUserRecentlyViewed.clear();
  }
}

export const defaultInteractionService = new InteractionService();
