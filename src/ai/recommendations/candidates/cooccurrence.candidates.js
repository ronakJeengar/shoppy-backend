import mongoose from "mongoose";
import { Order } from "../../../models/order.model.js";
import { inMemoryOrders } from "../../../controllers/order.controller.js";
import { defaultSemanticCandidateGenerator } from "./semantic.candidates.js";

export class CoOccurrenceCandidateGenerator {
  /**
   * Generates candidate products frequently bought together with targetProductId.
   */
  async getCandidates(targetProductId, { limit = 6, minCount = 1 } = {}) {
    if (!targetProductId) return [];

    const targetIdStr = String(targetProductId);
    const coCounts = new Map(); // productId -> count
    let totalTargetOrders = 0;

    // 1. Scan MongoDB Orders if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const orders = await Order.find({
          "items.productId": targetProductId,
          orderStatus: { $ne: "CANCELLED" },
        })
          .select("items")
          .limit(100)
          .lean();

        totalTargetOrders = orders.length;

        for (const ord of orders) {
          for (const item of ord.items || []) {
            const pid = String(item.productId || "");
            if (pid && pid !== targetIdStr) {
              coCounts.set(pid, (coCounts.get(pid) || 0) + 1);
            }
          }
        }
      } catch (err) {
        console.warn("CoOccurrenceCandidateGenerator: Mongo error:", err.message);
      }
    }

    // 2. Scan inMemoryOrders (in test/offline environments)
    if (totalTargetOrders === 0) {
      for (const ord of inMemoryOrders.values()) {
        if (ord.orderStatus === "CANCELLED") continue;
        const hasTarget = (ord.items || []).some(
          (it) => String(it.productId || it.product?._id || it.product) === targetIdStr
        );
        if (hasTarget) {
          totalTargetOrders++;
          for (const it of ord.items || []) {
            const pid = String(it.productId || it.product?._id || it.product || "");
            if (pid && pid !== targetIdStr) {
              coCounts.set(pid, (coCounts.get(pid) || 0) + 1);
            }
          }
        }
      }
    }

    // 3. Format candidates from co-occurrence graph
    const candidates = [];
    if (coCounts.size > 0 && totalTargetOrders > 0) {
      for (const [pid, count] of coCounts.entries()) {
        if (count >= minCount) {
          const confidence = count / totalTargetOrders;
          candidates.push({
            productId: pid,
            score: Math.min(1.0, confidence),
            source: "co_occurrence",
            reason: "Frequently bought together with this item",
            coCount: count,
          });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
    }

    // 4. Fallback if no multi-item purchase history exists yet (cold start)
    if (candidates.length === 0) {
      const semanticFallbacks = await defaultSemanticCandidateGenerator.getCandidates(
        targetProductId,
        { topK: limit }
      );
      return semanticFallbacks.map((c) => ({
        ...c,
        source: "co_occurrence_fallback",
        reason: "Customers also viewed this item",
      }));
    }

    return candidates.slice(0, limit);
  }
}

export const defaultCoOccurrenceCandidateGenerator = new CoOccurrenceCandidateGenerator();
