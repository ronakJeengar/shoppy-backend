import { test, describe } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import app from "../src/app.js";
import { Product } from "../src/models/product.model.js";
import { Category } from "../src/models/category.model.js";

describe("Phase 03 Product Catalog & Discovery Tests", () => {
  test("Category model requires name to be unique and trimmed", () => {
    const cat = new Category({ name: "  Fashion  " });
    assert.strictEqual(cat.name, "fashion");
  });

  test("Product model calculates default fields accurately", () => {
    const dummyCatId = new mongoose.Types.ObjectId();
    const prod = new Product({
      productName: "Sneakers",
      sellerName: "ShoeStore",
      price: 99.99,
      productImage: "https://example.com/shoe.jpg",
      category: dummyCatId,
    });

    assert.strictEqual(prod.productName, "Sneakers");
    assert.strictEqual(prod.price, 99.99);
    assert.strictEqual(prod.stock, 0);
    assert.strictEqual(prod.productRating, 0);
    assert.strictEqual(prod.category, dummyCatId);
  });

  test("GET /api/v1/categories returns 200 and array", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/categories`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.statusCode, 200);
      assert.ok(Array.isArray(data.data));
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/categories requires authentication with 401", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Gadgets" }),
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.statusCode, 401);
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products returns 200 with paginated envelope structure", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/products?page=1&limit=10`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.statusCode, 200);
      assert.ok(data.data.products !== undefined);
      assert.ok(Array.isArray(data.data.products));
      assert.ok(data.data.pagination !== undefined);
      assert.strictEqual(data.data.pagination.page, 1);
      assert.strictEqual(data.data.pagination.limit, 10);
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products/:id rejects invalid ObjectId format with 400", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/products/invalid-id-123`);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.statusCode, 400);
      assert.ok(data.message.includes("Invalid product ID"));
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/products/:id returns 404 for non-existent valid ObjectId", async () => {
    const server = app.listen(0);
    const port = server.address().port;
    const nonExistentId = new mongoose.Types.ObjectId().toString();

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/products/${nonExistentId}`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.statusCode, 404);
      assert.ok(data.message.includes("Product not found"));
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/products requires authentication with 401", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: "Test", price: 10 }),
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.statusCode, 401);
    } finally {
      server.close();
    }
  });
});
