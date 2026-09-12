import { test, describe } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import {
  normalizeCouponCode,
  validateAndCalculateCoupon,
} from "../src/services/coupon.service.js";

const testUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c999",
  email: "couponuser@example.com",
  fullname: "Coupon Tester",
  role: "USER",
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c001",
  email: "admin@example.com",
  fullname: "Admin User",
  role: "ADMIN",
};

const userToken = jwt.sign(
  testUser,
  process.env.ACCESS_TOKEN_KEY ||
    "shoppy_access_token_secret_key_development_example",
  { expiresIn: "1h" }
);

const adminToken = jwt.sign(
  adminUser,
  process.env.ACCESS_TOKEN_KEY ||
    "shoppy_access_token_secret_key_development_example",
  { expiresIn: "1h" }
);

const userHeaders = {
  Authorization: `Bearer ${userToken}`,
  "Content-Type": "application/json",
};

const adminHeaders = {
  Authorization: `Bearer ${adminToken}`,
  "Content-Type": "application/json",
};

describe("Feature 2: Indian Coupon & Promotion System Tests", () => {
  // 1. Service Layer Pure Calculation Tests
  describe("Coupon Service Calculations", () => {
    test("normalizeCouponCode trims and uppercases", () => {
      assert.strictEqual(normalizeCouponCode(" welcome10 "), "WELCOME10");
      assert.strictEqual(normalizeCouponCode("flat500"), "FLAT500");
    });

    test("Fixed discount calculation", async () => {
      const coupon = {
        code: "FLAT500",
        discountType: "FIXED",
        discountValue: 500,
        minimumOrderValue: 2000,
        maximumDiscountAmount: null,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      };

      const result = await validateAndCalculateCoupon({
        code: coupon.code,
        couponDoc: coupon,
        userId: testUser._id,
        cartItems: [{ price: 2500, quantity: 1, lineTotal: 2500 }],
      });

      assert.strictEqual(result.discountAmount, 500);
      assert.strictEqual(result.code, "FLAT500");
    });

    test("Percentage discount with maximum cap", async () => {
      const coupon = {
        code: "FESTIVE20",
        discountType: "PERCENTAGE",
        discountValue: 20,
        minimumOrderValue: 1000,
        maximumDiscountAmount: 1000,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      };

      // 20% of 10,000 = 2,000, but cap is 1,000
      const result = await validateAndCalculateCoupon({
        code: coupon.code,
        couponDoc: coupon,
        userId: testUser._id,
        cartItems: [{ price: 10000, quantity: 1, lineTotal: 10000 }],
      });

      assert.strictEqual(result.discountAmount, 1000);
    });

    test("Percentage discount without exceeding cap", async () => {
      const coupon = {
        code: "FESTIVE20",
        discountType: "PERCENTAGE",
        discountValue: 20,
        minimumOrderValue: 1000,
        maximumDiscountAmount: 1000,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      };

      // 20% of 2,000 = 400, below 1,000 cap
      const result = await validateAndCalculateCoupon({
        code: coupon.code,
        couponDoc: coupon,
        userId: testUser._id,
        cartItems: [{ price: 2000, quantity: 1, lineTotal: 2000 }],
      });

      assert.strictEqual(result.discountAmount, 400);
    });

    test("Rejects order below minimumOrderValue", async () => {
      const coupon = {
        code: "FLAT500",
        discountType: "FIXED",
        discountValue: 500,
        minimumOrderValue: 2000,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      };

      await assert.rejects(
        async () => {
          await validateAndCalculateCoupon({
            code: coupon.code,
            couponDoc: coupon,
            userId: testUser._id,
            cartItems: [{ price: 1500, quantity: 1, lineTotal: 1500 }],
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /Minimum order value/);
          return true;
        }
      );
    });

    test("Rejects inactive coupon", async () => {
      const coupon = {
        code: "INACTIVE",
        discountType: "FIXED",
        discountValue: 100,
        minimumOrderValue: 0,
        isActive: false,
        expiresAt: new Date(Date.now() + 86400000),
      };

      await assert.rejects(
        async () => {
          await validateAndCalculateCoupon({
            code: coupon.code,
            couponDoc: coupon,
            userId: testUser._id,
            cartItems: [{ price: 500, quantity: 1, lineTotal: 500 }],
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /active/i);
          return true;
        }
      );
    });

    test("Rejects expired coupon", async () => {
      const coupon = {
        code: "EXPIRED",
        discountType: "FIXED",
        discountValue: 100,
        minimumOrderValue: 0,
        isActive: true,
        expiresAt: new Date(Date.now() - 86400000),
      };

      await assert.rejects(
        async () => {
          await validateAndCalculateCoupon({
            code: coupon.code,
            couponDoc: coupon,
            userId: testUser._id,
            cartItems: [{ price: 500, quantity: 1, lineTotal: 500 }],
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /expired/);
          return true;
        }
      );
    });
  });

  // 2. API Endpoints
  describe("Coupon Endpoints", () => {
    test("GET /api/v1/coupons/available returns active coupons", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/coupons/available`, {
          headers: userHeaders,
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data.coupons));
        assert.ok(body.data.coupons.length > 0);
        // Verify none of the returned coupons are expired or inactive
        for (const c of body.data.coupons) {
          assert.notStrictEqual(c.code, "EXPIRED10");
          assert.notStrictEqual(c.code, "INACTIVE50");
        }
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/coupons/validate with valid code returns calculated discount", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/coupons/validate`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({
            code: "WELCOME10",
            subtotal: 1000,
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.coupon.code, "WELCOME10");
        // 10% of 1000 = 100 (cap is 250)
        assert.strictEqual(body.data.coupon.discountAmount, 100);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/coupons/validate rejects subtotal below minimumOrderValue", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/coupons/validate`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({
            code: "FLAT500", // min order 2499
            subtotal: 1500,
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.match(body.message, /Minimum order value/);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/coupons/validate rejects expired coupon", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/coupons/validate`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({
            code: "EXPIRED10",
            subtotal: 1000,
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.match(body.message, /expired/);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/coupons/validate rejects inactive coupon", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/coupons/validate`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({
            code: "INACTIVE50",
            subtotal: 1000,
          }),
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.match(body.message, /active/i);
      } finally {
        server.close();
      }
    });
  });

  // 3. Cart Coupon Flow
  describe("Cart Coupon Integration", () => {
    test("Apply coupon to cart recalculates totals with discount", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        // Add sample product to cart
        await fetch(`http://localhost:${port}/api/v1/cart/items`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({ productId: "64f2b1a2b3c4d5e6f7a8b001", quantity: 5 }),
        });

        // Apply coupon
        const applyRes = await fetch(`http://localhost:${port}/api/v1/cart/coupon`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({ code: "WELCOME10" }),
        });

        assert.strictEqual(applyRes.status, 200);
        const applyData = await applyRes.json();
        assert.strictEqual(applyData.success, true);
        assert.strictEqual(applyData.data.couponCode, "WELCOME10");
        assert.ok(applyData.data.discount > 0);
        assert.ok(applyData.data.appliedCoupon);
        assert.strictEqual(applyData.data.appliedCoupon.code, "WELCOME10");

        // Remove coupon
        const removeRes = await fetch(`http://localhost:${port}/api/v1/cart/coupon`, {
          method: "DELETE",
          headers: userHeaders,
        });

        assert.strictEqual(removeRes.status, 200);
        const removeData = await removeRes.json();
        assert.strictEqual(removeData.success, true);
        assert.strictEqual(removeData.data.couponCode, null);
        assert.strictEqual(removeData.data.discount, 0);
        assert.strictEqual(removeData.data.appliedCoupon, null);
      } finally {
        server.close();
      }
    });
  });

  // 4. Admin Coupon CRUD
  describe("Admin Coupon CRUD Operations", () => {
    let createdCouponId = null;

    test("GET /api/v1/admin/coupons rejects non-admin users with 403", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/coupons`, {
          headers: userHeaders,
        });
        assert.strictEqual(res.status, 403);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/admin/coupons creates a new coupon", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const uniqueCode = `TEST${Date.now()}`;
        const res = await fetch(`http://localhost:${port}/api/v1/admin/coupons`, {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({
            code: uniqueCode,
            name: "Test Admin Coupon",
            description: "Test description",
            discountType: "FIXED",
            discountValue: 150,
            minimumOrderValue: 500,
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          }),
        });

        assert.strictEqual(res.status, 201);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.data.code, uniqueCode);
        createdCouponId = data.data._id;
      } finally {
        server.close();
      }
    });

    test("PATCH /api/v1/admin/coupons/:id/status toggles status", async () => {
      if (!createdCouponId) return;
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(
          `http://localhost:${port}/api/v1/admin/coupons/${createdCouponId}/status`,
          {
            method: "PATCH",
            headers: adminHeaders,
          }
        );

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.data.isActive, false);
      } finally {
        server.close();
      }
    });

    test("DELETE /api/v1/admin/coupons/:id deletes the coupon", async () => {
      if (!createdCouponId) return;
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(
          `http://localhost:${port}/api/v1/admin/coupons/${createdCouponId}`,
          {
            method: "DELETE",
            headers: adminHeaders,
          }
        );

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
      } finally {
        server.close();
      }
    });
  });
});
