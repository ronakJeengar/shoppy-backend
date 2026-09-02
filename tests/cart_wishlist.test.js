import { test, describe } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";

const testUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c999",
  email: "cartuser@example.com",
  fullname: "Cart Tester",
  role: "USER",
};

const authToken = jwt.sign(
  testUser,
  process.env.ACCESS_TOKEN_KEY ||
    "shoppy_access_token_secret_key_development_example",
  { expiresIn: "1h" }
);

const authHeader = {
  Authorization: `Bearer ${authToken}`,
  "Content-Type": "application/json",
};

describe("Phase 05 Cart & Wishlist Tests", () => {
  test("GET /api/v1/cart rejects unauthenticated requests with 401", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/cart`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/wishlist rejects unauthenticated requests with 401", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/wishlist`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    } finally {
      server.close();
    }
  });

  test("Authenticated user can view initially empty cart", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/cart`, {
        headers: authHeader,
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.itemCount, 0);
      assert.strictEqual(data.data.subtotal, 0);
      assert.strictEqual(data.data.total, 0);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/cart/items adds product and authoritatively computes totals", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/cart/items`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({
          productId: "64f2b1a2b3c4d5e6f7a8b001",
          quantity: 2,
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.itemCount, 2);
      assert.strictEqual(data.data.items.length, 1);
      assert.strictEqual(data.data.items[0].quantity, 2);
      // 149.99 * 2 = 299.98
      assert.strictEqual(data.data.subtotal, 299.98);
      // Free shipping over $50
      assert.strictEqual(data.data.shipping, 0);
      assert.ok(data.data.total > data.data.subtotal);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/cart/items rejects quantity exceeding available stock with 400", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/cart/items`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({
          productId: "64f2b1a2b3c4d5e6f7a8b002",
          quantity: 999, // exceeds stock (28)
        }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/cart/items/:productId updates quantity correctly", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/cart/items/64f2b1a2b3c4d5e6f7a8b001`,
        {
          method: "PATCH",
          headers: authHeader,
          body: JSON.stringify({ quantity: 1 }),
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.itemCount, 1);
      assert.strictEqual(data.data.subtotal, 149.99);
    } finally {
      server.close();
    }
  });

  test("DELETE /api/v1/cart/items/:productId removes item from cart", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/cart/items/64f2b1a2b3c4d5e6f7a8b001`,
        {
          method: "DELETE",
          headers: authHeader,
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.items.length, 0);
      assert.strictEqual(data.data.total, 0);
    } finally {
      server.close();
    }
  });

  test("DELETE /api/v1/cart clears cart completely", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Add an item first
      await fetch(`http://localhost:${port}/api/v1/cart/items`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({
          productId: "64f2b1a2b3c4d5e6f7a8b003",
          quantity: 1,
        }),
      });

      // Clear cart
      const res = await fetch(`http://localhost:${port}/api/v1/cart`, {
        method: "DELETE",
        headers: authHeader,
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.itemCount, 0);
      assert.strictEqual(data.data.items.length, 0);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/wishlist/toggle toggles product bookmark state", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // First toggle: adds to wishlist
      const res1 = await fetch(`http://localhost:${port}/api/v1/wishlist/toggle`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({
          productId: "64f2b1a2b3c4d5e6f7a8b001",
        }),
      });
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.strictEqual(data1.success, true);
      assert.strictEqual(data1.data.inWishlist, true);

      // Verify in GET /wishlist
      const resGet = await fetch(`http://localhost:${port}/api/v1/wishlist`, {
        headers: authHeader,
      });
      const dataGet = await resGet.json();
      assert.strictEqual(dataGet.data.items.length, 1);

      // Second toggle: removes from wishlist
      const res2 = await fetch(`http://localhost:${port}/api/v1/wishlist/toggle`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({
          productId: "64f2b1a2b3c4d5e6f7a8b001",
        }),
      });
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.success, true);
      assert.strictEqual(data2.data.inWishlist, false);
    } finally {
      server.close();
    }
  });

  test("DELETE /api/v1/wishlist/:productId removes product from wishlist", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Add product
      await fetch(`http://localhost:${port}/api/v1/wishlist`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({
          productId: "64f2b1a2b3c4d5e6f7a8b002",
        }),
      });

      // Remove product
      const res = await fetch(
        `http://localhost:${port}/api/v1/wishlist/64f2b1a2b3c4d5e6f7a8b002`,
        {
          method: "DELETE",
          headers: authHeader,
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.inWishlist, false);
    } finally {
      server.close();
    }
  });
});
