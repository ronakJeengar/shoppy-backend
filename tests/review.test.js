import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import {
  memoryReviewStore,
  _resetMemoryReviewStore,
} from "../src/controllers/review.controller.js";
import {
  memoryAdminStore,
  _resetMemoryAdminStore,
} from "../src/controllers/admin.controller.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

// Users
const buyerUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c111",
  id: "64f1a2b3c4d5e6f7a8b9c111",
  email: "buyer@example.com",
  fullName: "Alice Buyer",
  username: "alice_b",
  role: "CUSTOMER",
  isActive: true,
};

const nonBuyerUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c222",
  id: "64f1a2b3c4d5e6f7a8b9c222",
  email: "stranger@example.com",
  fullName: "Bob Stranger",
  username: "bob_s",
  role: "CUSTOMER",
  isActive: true,
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c999",
  id: "64f1a2b3c4d5e6f7a8b9c999",
  email: "admin@shoppy.com",
  fullName: "Store Admin",
  username: "admin_super",
  role: "ADMIN",
  isActive: true,
};

const buyerToken = jwt.sign(buyerUser, secretKey, { expiresIn: "1h" });
const nonBuyerToken = jwt.sign(nonBuyerUser, secretKey, { expiresIn: "1h" });
const adminToken = jwt.sign(adminUser, secretKey, { expiresIn: "1h" });

const buyerHeaders = {
  Authorization: `Bearer ${buyerToken}`,
  "Content-Type": "application/json",
};

const nonBuyerHeaders = {
  Authorization: `Bearer ${nonBuyerToken}`,
  "Content-Type": "application/json",
};

const adminHeaders = {
  Authorization: `Bearer ${adminToken}`,
  "Content-Type": "application/json",
};

const testProductId = "64f2b1a2b3c4d5e6f7a8b001";

describe("Phase 10 Reviews & Ratings System Tests", () => {
  beforeEach(() => {
    _resetMemoryAdminStore();
    _resetMemoryReviewStore();

    // Seed test product
    memoryAdminStore.products.push({
      _id: testProductId,
      id: testProductId,
      productName: "Studio Wireless Headphones",
      sellerName: "AudioPhile Store",
      description: "Active Noise Cancelling",
      price: 199.99,
      stock: 50,
      productRating: 0,
      totalReviews: 0,
      isActive: true,
    });

    // Seed DELIVERED order for Alice (buyerUser) containing testProduct
    memoryAdminStore.orders.push({
      _id: "64f3c1a2b3c4d5e6f7a8b101",
      id: "64f3c1a2b3c4d5e6f7a8b101",
      orderNumber: "ORD-2026-DELIVERED",
      customer: buyerUser._id,
      customerName: buyerUser.fullName,
      status: "DELIVERED",
      orderItems: [
        {
          productId: testProductId,
          productName: "Studio Wireless Headphones",
          quantity: 1,
          price: 199.99,
        },
      ],
      totalAmount: 199.99,
      createdAt: new Date(),
    });
  });

  test("GET /api/v1/products/:productId/reviews returns 200 with summary & distribution", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.reviews));
      assert.strictEqual(typeof data.data.summary, "object");
      assert.strictEqual(typeof data.data.summary.averageRating, "number");
      assert.strictEqual(typeof data.data.summary.totalReviews, "number");
      assert.strictEqual(typeof data.data.summary.ratingDistribution, "object");
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/products/:productId/reviews rejects unauthenticated requests with 401", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: 5, comment: "Great headphones!" }),
        }
      );
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/products/:productId/reviews rejects non-purchaser with 403 Forbidden", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: nonBuyerHeaders,
          body: JSON.stringify({
            rating: 5,
            title: "Superb",
            comment: "Loved these headphones a lot!",
          }),
        }
      );
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /verified purchasers.*received/i);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/products/:productId/reviews rejects invalid rating bounds (0, 6, 4.5)", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // 0 stars
      const resZero = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({ rating: 0, comment: "Terrible product" }),
        }
      );
      assert.strictEqual(resZero.status, 400);

      // 6 stars
      const resSix = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({ rating: 6, comment: "Too awesome" }),
        }
      );
      assert.strictEqual(resSix.status, 400);

      // Decimal rating
      const resDecimal = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({ rating: 4.5, comment: "Decent pair" }),
        }
      );
      assert.strictEqual(resDecimal.status, 400);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/products/:productId/reviews rejects empty or too short comment", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({ rating: 5, comment: " ok " }), // < 3 trimmed chars
        }
      );
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /at least 3 characters/i);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/products/:productId/reviews allows verified buyer and aggregates product rating", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({
            rating: 5,
            title: "Crystal clear sound",
            comment: "Active noise cancellation works wonders on airplanes.",
          }),
        }
      );
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.rating, 5);
      assert.strictEqual(data.data.verifiedPurchase, true);
      assert.strictEqual(data.data.authorName, "Alice B."); // Safe name format

      // Verify product rating aggregation
      const prod = memoryAdminStore.products.find(
        (p) => p.id === testProductId
      );
      assert.strictEqual(prod.productRating, 5);
      assert.strictEqual(prod.totalReviews, 1);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/products/:productId/reviews prevents duplicate reviews from same user", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // First review succeeds
      await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({
            rating: 5,
            comment: "First review works fine.",
          }),
        }
      );

      // Second review by same user fails with 409 Conflict
      const secondRes = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({
            rating: 4,
            comment: "Attempting duplicate review.",
          }),
        }
      );
      assert.strictEqual(secondRes.status, 409);
      const data = await secondRes.json();
      assert.match(data.message, /already reviewed/i);
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products/:productId/reviews/eligibility correctly reports eligibility status", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // 1. Non-buyer eligibility
      const nonBuyerRes = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews/eligibility`,
        { headers: nonBuyerHeaders }
      );
      assert.strictEqual(nonBuyerRes.status, 200);
      const nonBuyerData = await nonBuyerRes.json();
      assert.strictEqual(nonBuyerData.data.canReview, false);
      assert.strictEqual(nonBuyerData.data.hasReviewed, false);

      // 2. Buyer before review
      const buyerRes = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews/eligibility`,
        { headers: buyerHeaders }
      );
      assert.strictEqual(buyerRes.status, 200);
      const buyerData = await buyerRes.json();
      assert.strictEqual(buyerData.data.canReview, true);
      assert.strictEqual(buyerData.data.hasReviewed, false);
      assert.strictEqual(buyerData.data.isVerifiedPurchase, true);

      // Submit review
      await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({ rating: 4, comment: "High quality gear!" }),
        }
      );

      // 3. Buyer after review
      const reviewedRes = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews/eligibility`,
        { headers: buyerHeaders }
      );
      assert.strictEqual(reviewedRes.status, 200);
      const reviewedData = await reviewedRes.json();
      assert.strictEqual(reviewedData.data.canReview, false);
      assert.strictEqual(reviewedData.data.hasReviewed, true);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/reviews/:id enforces IDOR ownership and re-aggregates rating", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // Buyer creates 5-star review
      const createRes = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({ rating: 5, comment: "Initial review" }),
        }
      );
      const createData = await createRes.json();
      const reviewId = createData.data.id;

      // 1. Non-buyer attempts to edit buyer's review (IDOR)
      const attackRes = await fetch(
        `http://localhost:${port}/api/v1/reviews/${reviewId}`,
        {
          method: "PATCH",
          headers: nonBuyerHeaders,
          body: JSON.stringify({ rating: 1, comment: "Hacked your review!" }),
        }
      );
      assert.strictEqual(attackRes.status, 403);

      // 2. Buyer updates own review from 5 stars to 3 stars
      const updateRes = await fetch(
        `http://localhost:${port}/api/v1/reviews/${reviewId}`,
        {
          method: "PATCH",
          headers: buyerHeaders,
          body: JSON.stringify({ rating: 3, comment: "Sound is actually just okay." }),
        }
      );
      assert.strictEqual(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.strictEqual(updateData.data.rating, 3);

      // Re-aggregated product rating should be 3
      const prod = memoryAdminStore.products.find(
        (p) => p.id === testProductId
      );
      assert.strictEqual(prod.productRating, 3);
    } finally {
      server.close();
    }
  });

  test("DELETE /api/v1/reviews/:id enforces ownership and updates product aggregate", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const createRes = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({ rating: 4, comment: "Review to delete" }),
        }
      );
      const createData = await createRes.json();
      const reviewId = createData.data.id;

      // 1. Non-buyer cannot delete
      const attackRes = await fetch(
        `http://localhost:${port}/api/v1/reviews/${reviewId}`,
        {
          method: "DELETE",
          headers: nonBuyerHeaders,
        }
      );
      assert.strictEqual(attackRes.status, 403);

      // 2. Owner can delete
      const deleteRes = await fetch(
        `http://localhost:${port}/api/v1/reviews/${reviewId}`,
        {
          method: "DELETE",
          headers: buyerHeaders,
        }
      );
      assert.strictEqual(deleteRes.status, 200);

      // Verify product rating reset to 0
      const prod = memoryAdminStore.products.find(
        (p) => p.id === testProductId
      );
      assert.strictEqual(prod.productRating, 0);
      assert.strictEqual(prod.totalReviews, 0);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/admin/reviews/:id/status allows admin moderation and updates public rating", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const createRes = await fetch(
        `http://localhost:${port}/api/v1/products/${testProductId}/reviews`,
        {
          method: "POST",
          headers: buyerHeaders,
          body: JSON.stringify({ rating: 5, comment: "Inappropriate review text" }),
        }
      );
      const createData = await createRes.json();
      const reviewId = createData.data.id;

      // Non-admin cannot moderate
      const unauthModRes = await fetch(
        `http://localhost:${port}/api/v1/admin/reviews/${reviewId}/status`,
        {
          method: "PATCH",
          headers: buyerHeaders,
          body: JSON.stringify({ status: "HIDDEN" }),
        }
      );
      assert.strictEqual(unauthModRes.status, 403);

      // Admin hides review
      const adminModRes = await fetch(
        `http://localhost:${port}/api/v1/admin/reviews/${reviewId}/status`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({
            status: "HIDDEN",
            reason: "Violation of community standards",
          }),
        }
      );
      assert.strictEqual(adminModRes.status, 200);

      // Product aggregate excludes hidden review
      const prod = memoryAdminStore.products.find(
        (p) => p.id === testProductId
      );
      assert.strictEqual(prod.productRating, 0);
      assert.strictEqual(prod.totalReviews, 0);
    } finally {
      server.close();
    }
  });
});
