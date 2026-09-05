import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { defaultSemanticCandidateGenerator } from "../src/ai/recommendations/candidates/semantic.candidates.js";
import { defaultAffinityCandidateGenerator } from "../src/ai/recommendations/candidates/affinity.candidates.js";
import { defaultCoOccurrenceCandidateGenerator } from "../src/ai/recommendations/candidates/cooccurrence.candidates.js";
import { defaultTrendingCandidateGenerator } from "../src/ai/recommendations/candidates/trending.candidates.js";
import { defaultRecommendationRanker } from "../src/ai/recommendations/ranking.service.js";
import { defaultRecommendationService } from "../src/ai/recommendations/recommendation.service.js";
import {
  defaultInteractionService,
  memoryInteractionEvents,
  memoryUserRecentlyViewed,
} from "../src/ai/recommendations/interaction.service.js";
import { memoryCarts } from "../src/controllers/cart.controller.js";
import { memoryWishlists } from "../src/controllers/wishlist.controller.js";
import { inMemoryOrders } from "../src/controllers/order.controller.js";

const JWT_SECRET =
  process.env.ACCESS_TOKEN_KEY || "shoppy_access_token_secret_key_development_example";

const makeToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

describe("Phase 16 — AI Recommendations & Personalization Pipeline Tests", () => {
  let server;
  let baseUrl;

  const testUserAlice = {
    _id: "64f1a2b3c4d5e6f7a8b9c111",
    username: "alice",
    email: "alice@example.com",
    role: "CUSTOMER",
  };
  const aliceToken = makeToken(testUserAlice);

  const testUserBob = {
    _id: "64f1a2b3c4d5e6f7a8b9c222",
    username: "bob",
    email: "bob@example.com",
    role: "CUSTOMER",
  };
  const bobToken = makeToken(testUserBob);

  beforeEach(async () => {
    defaultInteractionService.clearMemory();
    memoryCarts.clear();
    memoryWishlists.clear();
    inMemoryOrders.clear();
  });

  const startServer = () => {
    return new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });
  };

  const stopServer = () => {
    return new Promise((resolve) => {
      if (server) server.close(resolve);
      else resolve();
    });
  };

  test("1. Semantic Candidate Generator retrieves relevant candidate items and excludes target", async () => {
    const targetId = "64f2b1a2b3c4d5e6f7a8b001"; // Wireless Headphones (electronics)
    const candidates = await defaultSemanticCandidateGenerator.getCandidates(targetId, {
      topK: 5,
    });

    assert.ok(Array.isArray(candidates), "Candidates must be an array");
    assert.ok(candidates.length > 0, "Must return candidate items");
    // Ensure target product is never in candidates
    const hasTarget = candidates.some((c) => String(c.productId) === targetId);
    assert.equal(hasTarget, false, "Target product must be excluded from candidates");
    assert.ok(candidates[0].score >= 0, "Scores must be non-negative numbers");
    assert.equal(candidates[0].source, "semantic");
  });

  test("2. Co-Occurrence Candidate Generator discovers frequently bought together items", async () => {
    const headPhonesId = "64f2b1a2b3c4d5e6f7a8b001";
    const waterBottleId = "64f2b1a2b3c4d5e6f7a8b006";
    const keyboardId = "64f2b1a2b3c4d5e6f7a8b003";

    // Seed 2 orders containing headphones and water bottle together
    inMemoryOrders.set("ord_bundle_1", {
      _id: "ord_bundle_1",
      customer: testUserAlice._id,
      orderStatus: "CONFIRMED",
      items: [
        { productId: headPhonesId, productName: "Headphones" },
        { productId: waterBottleId, productName: "Water Bottle" },
      ],
    });
    inMemoryOrders.set("ord_bundle_2", {
      _id: "ord_bundle_2",
      customer: testUserBob._id,
      orderStatus: "CONFIRMED",
      items: [
        { productId: headPhonesId, productName: "Headphones" },
        { productId: waterBottleId, productName: "Water Bottle" },
        { productId: keyboardId, productName: "Keyboard" },
      ],
    });

    const candidates = await defaultCoOccurrenceCandidateGenerator.getCandidates(headPhonesId, {
      limit: 5,
    });

    assert.ok(candidates.length >= 2, "Should discover at least 2 co-purchased items");
    // Water bottle co-occurred in 2 orders, keyboard in 1 order
    assert.equal(candidates[0].productId, waterBottleId);
    assert.equal(candidates[0].coCount, 2);
    assert.equal(candidates[0].source, "co_occurrence");
    assert.ok(candidates[0].reason.includes("bought together"));
  });

  test("3. Affinity Candidate Generator incorporates cart, wishlist, and recency decay", async () => {
    const userId = testUserAlice._id;

    // Alice adds electronics keyboard to cart
    memoryCarts.set(userId, [
      {
        product: {
          _id: "64f2b1a2b3c4d5e6f7a8b003",
          category: { _id: "64f1a2b3c4d5e6f7a8b9c001", name: "electronics" },
        },
        quantity: 1,
      },
    ]);

    // Alice viewed a sports item 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    memoryInteractionEvents.push({
      user: userId,
      eventType: "VIEW_PRODUCT",
      product: "64f2b1a2b3c4d5e6f7a8b006",
      category: "sports & outdoors",
      createdAt: tenDaysAgo,
    });

    const candidates = await defaultAffinityCandidateGenerator.getCandidates(userId, { topK: 10 });
    assert.ok(candidates.length > 0, "Must return affinity candidates");
    assert.ok(candidates.some((c) => c.source === "affinity"));

    // Verify recency decay math
    const decayRecent = defaultAffinityCandidateGenerator.calculateRecencyDecay(new Date());
    const decayOld = defaultAffinityCandidateGenerator.calculateRecencyDecay(tenDaysAgo);
    assert.ok(decayRecent > decayOld, "Recent interactions must carry higher weight than old ones");
  });

  test("4. Recommendation Ranker authoritatively excludes inactive and out-of-stock products", async () => {
    const rawCandidates = [
      { productId: "64f2b1a2b3c4d5e6f7a8b001", score: 0.9, source: "semantic" },
      { productId: "non_existent_fake_id", score: 0.99, source: "semantic" },
    ];

    const ranked = await defaultRecommendationRanker.rankCandidates(rawCandidates, {
      requireInStock: true,
      limit: 10,
    });

    assert.equal(ranked.length, 1, "Fake/inactive products must be authoritatively stripped");
    assert.equal(ranked[0].id, "64f2b1a2b3c4d5e6f7a8b001");
    assert.ok(ranked[0].stock > 0, "Ranked product must be verified in-stock");
    assert.ok(ranked[0].recommendationReason, "Must provide explainability reason");
  });

  test("5. Diversity constraint limits items from a single category", async () => {
    // 3 electronics items in fallback: 001, 002, 003
    const rawCandidates = [
      { productId: "64f2b1a2b3c4d5e6f7a8b001", score: 0.95, source: "test" },
      { productId: "64f2b1a2b3c4d5e6f7a8b002", score: 0.94, source: "test" },
      { productId: "64f2b1a2b3c4d5e6f7a8b003", score: 0.93, source: "test" },
      { productId: "64f2b1a2b3c4d5e6f7a8b004", score: 0.85, source: "test" }, // footwear
      { productId: "64f2b1a2b3c4d5e6f7a8b006", score: 0.84, source: "test" }, // sports
    ];

    const ranked = await defaultRecommendationRanker.rankCandidates(rawCandidates, {
      maxPerCategory: 2, // Limit to 2 per category
      limit: 4,
    });

    const electronicsCount = ranked.filter(
      (r) => r.category?.name === "electronics" || String(r.category?.id).includes("001")
    ).length;

    assert.equal(electronicsCount, 2, "Diversity must cap electronics items to maxPerCategory = 2");
    assert.ok(ranked.length >= 3, "Diversity must include other categories");
  });

  test("6. Cold-Start handling: Guest user receives valid trending recommendations (never empty)", async () => {
    const result = await defaultRecommendationService.getPersonalized({
      userId: null,
      limit: 5,
    });

    assert.equal(result.recommendationType, "personalized");
    assert.equal(result.metadata.isColdStart, true, "Guest must trigger cold start");
    assert.ok(result.products.length > 0, "Cold start must never return empty recommendations");
    assert.ok(result.reason.includes("trending") || result.reason.includes("Popular"));
  });

  test("7. End-to-End API: GET /api/v1/recommendations returns personalized feed", async () => {
    await startServer();
    try {
      const res = await fetch(`${baseUrl}/recommendations?type=personalized&limit=5`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.recommendationType, "personalized");
      assert.ok(Array.isArray(body.data.products));
      assert.ok(body.data.products.length > 0);
      assert.ok(body.data.reason);
      assert.ok(body.data.metadata.algorithmVersion);
    } finally {
      await stopServer();
    }
  });

  test("8. End-to-End API: GET /api/v1/recommendations?type=similar requires productId", async () => {
    await startServer();
    try {
      // 1. Without productId -> 400 Bad Request
      const resBad = await fetch(`${baseUrl}/recommendations?type=similar`);
      assert.equal(resBad.status, 400);

      // 2. With productId -> 200 OK
      const prodId = "64f2b1a2b3c4d5e6f7a8b001";
      const resGood = await fetch(`${baseUrl}/recommendations?type=similar&productId=${prodId}`);
      const body = await resGood.json();

      assert.equal(resGood.status, 200);
      assert.equal(body.data.recommendationType, "similar");
      assert.equal(body.data.productId, prodId);
      assert.ok(body.data.products.length > 0);
      // Ensure target product is excluded from its own similar list
      assert.equal(body.data.products.some((p) => p.id === prodId), false);
    } finally {
      await stopServer();
    }
  });

  test("9. End-to-End API: GET /api/v1/recommendations?type=trending supports category filter", async () => {
    await startServer();
    try {
      const res = await fetch(
        `${baseUrl}/recommendations?type=trending&categoryId=64f1a2b3c4d5e6f7a8b9c001&limit=3`
      );
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.recommendationType, "trending");
      assert.ok(body.data.products.length > 0);
      assert.ok(body.data.products.length <= 3);
    } finally {
      await stopServer();
    }
  });

  test("10. End-to-End API: POST /api/v1/recommendations/events tracks interaction and updates recentlyViewed", async () => {
    await startServer();
    try {
      const prodId = "64f2b1a2b3c4d5e6f7a8b001";

      const res = await fetch(`${baseUrl}/recommendations/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          eventType: "VIEW_PRODUCT",
          productId: prodId,
          categoryId: "64f1a2b3c4d5e6f7a8b9c001",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.data.recorded, true);

      // Verify recently viewed list has this product for Alice
      const recentlyViewed = await defaultInteractionService.getUserRecentlyViewed(
        testUserAlice._id
      );
      assert.ok(recentlyViewed.includes(prodId), "Product must be in Alice's recently viewed");
    } finally {
      await stopServer();
    }
  });

  test("11. Security & Anti-IDOR: Client cannot inject arbitrary userId in event body", async () => {
    await startServer();
    try {
      // Alice sends an event but puts Bob's ID in the body
      const res = await fetch(`${baseUrl}/recommendations/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          userId: testUserBob._id, // Malicious spoof attempt
          eventType: "VIEW_PRODUCT",
          productId: "64f2b1a2b3c4d5e6f7a8b006",
        }),
      });

      assert.equal(res.status, 201);

      // Bob's recently viewed MUST NOT have this product!
      const bobViewed = await defaultInteractionService.getUserRecentlyViewed(testUserBob._id);
      assert.equal(
        bobViewed.includes("64f2b1a2b3c4d5e6f7a8b006"),
        false,
        "Bob's profile must remain unaffected by Alice's spoof attempt"
      );

      // Alice's profile should have it
      const aliceViewed = await defaultInteractionService.getUserRecentlyViewed(testUserAlice._id);
      assert.equal(aliceViewed.includes("64f2b1a2b3c4d5e6f7a8b006"), true);
    } finally {
      await stopServer();
    }
  });

  test("12. Bounded limit protection: Requesting 1000 items is clamped to maximum limit 30", async () => {
    await startServer();
    try {
      const res = await fetch(`${baseUrl}/recommendations?limit=1000`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.data.products.length <= 30, "Response must be bounded to maxLimit 30");
    } finally {
      await stopServer();
    }
  });
});
