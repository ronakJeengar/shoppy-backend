import { test, describe } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { FlashSaleService, memoryFlashSales } from "../src/services/flashSale.service.js";
import { memoryCarts, memoryCartCoupons } from "../src/controllers/cart.controller.js";

const testUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c999",
  email: "customer@example.com",
  fullname: "Customer Tester",
  role: "CUSTOMER",
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c001",
  email: "admin@example.com",
  fullname: "Admin User",
  role: "ADMIN",
};

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

const userToken = jwt.sign(testUser, secretKey, { expiresIn: "1h" });
const adminToken = jwt.sign(adminUser, secretKey, { expiresIn: "1h" });

const userHeaders = {
  Authorization: `Bearer ${userToken}`,
  "Content-Type": "application/json",
};

const adminHeaders = {
  Authorization: `Bearer ${adminToken}`,
  "Content-Type": "application/json",
};

describe("Feature 4: Backend-Driven Flash Sale / Quick Sale System Tests", () => {
  // 1. Service Layer Tests
  describe("Flash Sale Service Scheduling & Filters", () => {
    test("getActiveFlashSales returns active, non-expired, non-scheduled flash sales with serverTime", async () => {
      const result = await FlashSaleService.getActiveFlashSales({
        now: new Date(),
        limit: 10,
      });

      assert.ok(result);
      assert.ok(result.serverTime);
      assert.ok(Array.isArray(result.flashSales));
      assert.ok(result.flashSales.length > 0);

      const now = Date.now();
      for (const sale of result.flashSales) {
        assert.strictEqual(sale.isActive, true);
        const s = new Date(sale.startAt).getTime();
        const e = new Date(sale.endAt).getTime();
        assert.ok(s <= now + 1000, `startAt ${sale.startAt} should be <= now`);
        assert.ok(e >= now - 1000, `endAt ${sale.endAt} should be >= now`);
      }
    });

    test("getActiveFlashSales excludes expired sales", async () => {
      const result = await FlashSaleService.getActiveFlashSales({
        now: new Date(),
      });
      const expired = result.flashSales.find(
        (s) => s.id === "fs_expired_flash" || s.title.toLowerCase().includes("yesterday")
      );
      assert.strictEqual(expired, undefined, "Expired sales must be excluded");
    });

    test("getActiveFlashSales excludes future scheduled quick sales", async () => {
      const result = await FlashSaleService.getActiveFlashSales({
        now: new Date(),
      });
      const upcoming = result.flashSales.find(
        (s) => s.id === "fs_upcoming_weekend" || s.title.toLowerCase().includes("weekend")
      );
      assert.strictEqual(upcoming, undefined, "Upcoming sales must be excluded from active");
    });

    test("getActiveFlashSales excludes deactivated flash sales", async () => {
      const result = await FlashSaleService.getActiveFlashSales({
        now: new Date(),
      });
      const inactive = result.flashSales.find((s) => s.id === "fs_inactive_test");
      assert.strictEqual(inactive, undefined, "Deactivated sales must be excluded");
    });

    test("Deterministic ordering: priority DESC, endAt ASC", async () => {
      const result = await FlashSaleService.getActiveFlashSales({
        now: new Date(),
      });
      for (let i = 0; i < result.flashSales.length - 1; i++) {
        const curr = result.flashSales[i];
        const next = result.flashSales[i + 1];
        if (curr.priority === next.priority) {
          assert.ok(
            new Date(curr.endAt).getTime() <= new Date(next.endAt).getTime(),
            `endAt should be earlier or equal for same priority`
          );
        } else {
          assert.ok(curr.priority >= next.priority, `priority must be descending`);
        }
      }
    });

    test("getUpcomingFlashSales returns future scheduled sales", async () => {
      const result = await FlashSaleService.getUpcomingFlashSales({
        now: new Date(),
      });
      assert.ok(Array.isArray(result.flashSales));
      const upcoming = result.flashSales.find(
        (s) => s.id === "fs_upcoming_weekend" || s.name === "WEEKEND_QUICK_SALE"
      );
      assert.ok(upcoming, "Upcoming sale should be present in upcoming list");
      assert.ok(new Date(upcoming.startAt) > new Date());
    });
  });

  // 2. Pricing & Validation Tests
  describe("Flash Sale Pricing & Validation Integrity", () => {
    test("Rejects flash sale creation if endAt <= startAt", async () => {
      const past = new Date(Date.now() - 3600000);
      const future = new Date(Date.now() + 3600000);

      await assert.rejects(
        async () => {
          await FlashSaleService.createFlashSale({
            name: "INVALID_DATES",
            title: "Invalid Dates",
            startAt: future,
            endAt: past,
          });
        },
        /endAt must be strictly greater than startAt/i
      );
    });

    test("Rejects flash sale item if salePrice > regularPrice", () => {
      assert.throws(() => {
        FlashSaleService.computeSalePrice(1000, "FIXED_PRICE", 1500, 1500);
      }, /cannot be higher than regular price/i);
    });

    test("Rejects flash sale item if salePrice <= 0", () => {
      assert.throws(() => {
        FlashSaleService.computeSalePrice(1000, "FIXED_PRICE", 0, 0);
      }, /strictly greater than 0/i);
    });

    test("Correctly computes percentage discount", () => {
      const computed = FlashSaleService.computeSalePrice(10000, "PERCENTAGE", 35);
      assert.strictEqual(computed, 6500);
    });

    test("Correctly computes fixed amount discount", () => {
      const computed = FlashSaleService.computeSalePrice(10000, "FIXED_AMOUNT", 2500);
      assert.strictEqual(computed, 7500);
    });

    test("Correctly enforces fixed sale price", () => {
      const computed = FlashSaleService.computeSalePrice(10000, "FIXED_PRICE", 4999);
      assert.strictEqual(computed, 4999);
    });
  });

  // 3. Active Product Flash Sale Resolution & Limits
  describe("Active Product Promotion & Conflict Resolution", () => {
    test("getActiveProductFlashSale finds active flash promotion for eligible product", async () => {
      const promo = await FlashSaleService.getActiveProductFlashSale("64f2b1a2b3c4d5e6f7a8b801");
      assert.ok(promo);
      assert.strictEqual(promo.salePrice, 9999);
      assert.strictEqual(promo.regularPrice, 14999);
      assert.strictEqual(promo.maximumQuantityPerOrder, 2);
    });

    test("getActiveProductFlashSale skips sold-out items (stockSold >= stockAllocated)", async () => {
      // 64f2b1a2b3c4d5e6f7a8b803 has stockAllocated: 40, stockSold: 40
      const promo = await FlashSaleService.getActiveProductFlashSale("64f2b1a2b3c4d5e6f7a8b803");
      assert.strictEqual(promo, null, "Sold out flash sale items must not be returned as active promotions");
    });

    test("getActiveProductFlashSale returns null for products not in any active sale", async () => {
      const promo = await FlashSaleService.getActiveProductFlashSale("non_existent_product_id");
      assert.strictEqual(promo, null);
    });
  });

  // 4. Public API Endpoints
  describe("Public Flash Sale Endpoints", () => {
    test("GET /api/v1/flash-sales/active returns 200 with flash sales and serverTime", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/flash-sales/active`);
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.ok(json.data.serverTime);
        assert.ok(Array.isArray(json.data.flashSales));
        assert.ok(json.data.flashSales.length > 0);

        const first = json.data.flashSales[0];
        assert.ok(first.id);
        assert.ok(first.title);
        assert.ok(Array.isArray(first.items));
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/flash-sales/upcoming returns 200", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/flash-sales/upcoming`);
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.ok(Array.isArray(json.data.flashSales));
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/flash-sales/product/:productId returns promotion status", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(
          `http://localhost:${port}/api/v1/flash-sales/product/64f2b1a2b3c4d5e6f7a8b801`
        );
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.data.isFlashSale, true);
        assert.strictEqual(json.data.flashSale.salePrice, 9999);
      } finally {
        server.close();
      }
    });
  });

  // 5. Cart & Pricing Hierarchy Integration
  describe("Cart & Flash Sale Pricing Integration", () => {
    test("Cart calculates subtotal using authoritative flash sale price", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        // Clear user cart first
        await fetch(`http://localhost:${port}/api/v1/cart`, {
          method: "DELETE",
          headers: userHeaders,
        });

        // Add 1 unit of flash sale product 64f2b1a2b3c4d5e6f7a8b801 (salePrice: 9999, regular: 14999)
        const addRes = await fetch(`http://localhost:${port}/api/v1/cart/items`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({
            productId: "64f2b1a2b3c4d5e6f7a8b801",
            quantity: 1,
          }),
        });

        assert.strictEqual(addRes.status, 200);
        const addJson = await addRes.json();
        assert.strictEqual(addJson.success, true);
        assert.strictEqual(addJson.data.itemCount, 1);
        const item = addJson.data.items[0];
        assert.strictEqual(item.price, 9999);
        assert.strictEqual(item.isFlashSale, true);
        assert.strictEqual(item.regularPrice, 14999);
        assert.strictEqual(addJson.data.subtotal, 9999);
      } finally {
        server.close();
      }
    });

    test("Enforces maximumQuantityPerOrder purchase limit for flash sale items", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        // 64f2b1a2b3c4d5e6f7a8b801 has maximumQuantityPerOrder: 2
        // Trying to add quantity 3 should throw 400
        const res = await fetch(`http://localhost:${port}/api/v1/cart/items`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({
            productId: "64f2b1a2b3c4d5e6f7a8b801",
            quantity: 3,
          }),
        });

        assert.strictEqual(res.status, 400);
        const json = await res.json();
        assert.ok(json.message.includes("Flash sale"));
      } finally {
        server.close();
      }
    });

    test("Pricing Hierarchy: Flash Sale Price -> Coupon Application -> Tax -> Total", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        // Clear cart
        await fetch(`http://localhost:${port}/api/v1/cart`, {
          method: "DELETE",
          headers: userHeaders,
        });

        // Add 1 flash sale unit (sale price: ₹9,999)
        await fetch(`http://localhost:${port}/api/v1/cart/items`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({
            productId: "64f2b1a2b3c4d5e6f7a8b801",
            quantity: 1,
          }),
        });

        // Apply coupon FLAT500 (₹500 off on minimum ₹1999)
        const couponRes = await fetch(`http://localhost:${port}/api/v1/cart/coupon`, {
          method: "POST",
          headers: userHeaders,
          body: JSON.stringify({ code: "FLAT500" }),
        });

        assert.strictEqual(couponRes.status, 200);
        const couponJson = await couponRes.json();
        assert.strictEqual(couponJson.data.subtotal, 9999);
        assert.strictEqual(couponJson.data.discount, 500);
        // Net taxable value after flash sale discount AND coupon discount
        assert.strictEqual(couponJson.data.couponCode, "FLAT500");
        assert.ok(couponJson.data.total < 9999);
      } finally {
        server.close();
      }
    });
  });

  // 6. Admin Authorization & CRUD Endpoints
  describe("Admin Flash Sale Management Endpoints", () => {
    test("GET /api/v1/admin/flash-sales rejects unauthenticated requests with 401", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/flash-sales`);
        assert.strictEqual(res.status, 401);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/admin/flash-sales rejects non-admin users with 403", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/flash-sales`, {
          headers: userHeaders,
        });
        assert.strictEqual(res.status, 403);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/admin/flash-sales allows admin with 200", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/flash-sales`, {
          headers: adminHeaders,
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.ok(Array.isArray(json.data.items));
        assert.ok(json.data.pagination);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/admin/flash-sales creates and manages flash sale lifecycle", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const payload = {
          name: "DIWALI_MIDNIGHT_RUSH",
          title: "Diwali Midnight Rush Sale",
          description: "Exclusive midnight flash deals on electronics",
          saleType: "FLASH_SALE",
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 24 * 3600000).toISOString(),
          priority: 25,
          items: [
            {
              product: "64f2b1a2b3c4d5e6f7a8b801",
              regularPrice: 14999,
              discountType: "FIXED_PRICE",
              discountValue: 8999,
              salePrice: 8999,
              maximumQuantityPerOrder: 1,
              stockAllocated: 50,
            },
          ],
        };

        const createRes = await fetch(`http://localhost:${port}/api/v1/admin/flash-sales`, {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify(payload),
        });

        assert.strictEqual(createRes.status, 201);
        const createJson = await createRes.json();
        assert.strictEqual(createJson.success, true);
        assert.strictEqual(createJson.data.name, "DIWALI_MIDNIGHT_RUSH");
        assert.strictEqual(createJson.data.items[0].salePrice, 8999);

        const createdId = createJson.data.id;

        // Toggle status
        const toggleRes = await fetch(
          `http://localhost:${port}/api/v1/admin/flash-sales/${createdId}/status`,
          {
            method: "PATCH",
            headers: adminHeaders,
            body: JSON.stringify({ isActive: false }),
          }
        );
        assert.strictEqual(toggleRes.status, 200);

        // Delete flash sale
        const delRes = await fetch(
          `http://localhost:${port}/api/v1/admin/flash-sales/${createdId}`,
          {
            method: "DELETE",
            headers: adminHeaders,
          }
        );
        assert.strictEqual(delRes.status, 200);
      } finally {
        server.close();
      }
    });
  });
});
