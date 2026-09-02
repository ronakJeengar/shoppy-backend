import { test, describe } from "node:test";
import assert from "node:assert";
import app from "../src/app.js";

describe("Phase 04 Search & Discovery Pipeline Tests", () => {
  test("GET /api/v1/products?q=wireless returns matching products", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/products?q=wireless`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.products.length > 0);
      assert.ok(
        data.data.products[0].productName.toLowerCase().includes("wireless") ||
          data.data.products[0].description.toLowerCase().includes("wireless")
      );
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products safely handles special regex characters without crashing", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Query containing regex metacharacters: (), [], {}, *, +, ?, ^, $, |
      const complexQuery = encodeURIComponent("wireless (noise)* [pro] + {test}?");
      const res = await fetch(`http://localhost:${port}/api/v1/products?q=${complexQuery}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.products));
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products rejects queries exceeding 100 characters with 400", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const longQuery = "a".repeat(105);
      const res = await fetch(`http://localhost:${port}/api/v1/products?q=${longQuery}`);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.statusCode, 400);
      assert.ok(data.message.includes("100 characters"));
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products/suggestions returns relevant autocomplete suggestions", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/products/suggestions?q=wire`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.query, "wire");
      assert.ok(Array.isArray(data.data.suggestions));
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products/suggestions returns empty suggestions on blank query", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/products/suggestions?q=`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.suggestions.length, 0);
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products supports multi-attribute filters (minPrice, maxPrice, inStock, minRating)", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/products?minPrice=20&maxPrice=100&inStock=true&minRating=4`
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      for (const p of data.data.products) {
        assert.ok(p.price >= 20 && p.price <= 100);
        assert.ok(p.stock > 0);
        assert.ok(p.productRating >= 4);
      }
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products supports sorting by price_asc and price_desc", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const resAsc = await fetch(`http://localhost:${port}/api/v1/products?sort=price_asc`);
      assert.strictEqual(resAsc.status, 200);
      const dataAsc = await resAsc.json();
      const productsAsc = dataAsc.data.products;
      if (productsAsc.length >= 2) {
        assert.ok(productsAsc[0].price <= productsAsc[1].price);
      }

      const resDesc = await fetch(`http://localhost:${port}/api/v1/products?sort=price_desc`);
      assert.strictEqual(resDesc.status, 200);
      const dataDesc = await resDesc.json();
      const productsDesc = dataDesc.data.products;
      if (productsDesc.length >= 2) {
        assert.ok(productsDesc[0].price >= productsDesc[1].price);
      }
    } finally {
      server.close();
    }
  });
});
