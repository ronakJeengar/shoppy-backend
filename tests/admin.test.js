import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import {
  memoryAdminStore,
  _resetMemoryAdminStore,
} from "../src/controllers/admin.controller.js";
import { memoryAuditLogs } from "../src/utils/auditLogger.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

const customerUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c101",
  id: "64f1a2b3c4d5e6f7a8b9c101",
  email: "customer@example.com",
  fullName: "Regular Customer",
  username: "regular_cust",
  role: "CUSTOMER",
  isActive: true,
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c999",
  id: "64f1a2b3c4d5e6f7a8b9c999",
  email: "admin@shoppy.com",
  fullName: "Super Admin",
  username: "super_admin",
  role: "ADMIN",
  isActive: true,
};

const customerToken = jwt.sign(customerUser, secretKey, { expiresIn: "1h" });
const adminToken = jwt.sign(adminUser, secretKey, { expiresIn: "1h" });

const customerHeaders = {
  Authorization: `Bearer ${customerToken}`,
  "Content-Type": "application/json",
};

const adminHeaders = {
  Authorization: `Bearer ${adminToken}`,
  "Content-Type": "application/json",
};

describe("Phase 09 Admin Dashboard & Admin Management Tests", () => {
  beforeEach(() => {
    _resetMemoryAdminStore();

    // Seed test users
    memoryAdminStore.users.push(
      { ...customerUser },
      { ...adminUser },
      {
        _id: "64f1a2b3c4d5e6f7a8b9c102",
        id: "64f1a2b3c4d5e6f7a8b9c102",
        email: "alice@example.com",
        fullName: "Alice Wonderland",
        username: "alice_w",
        role: "CUSTOMER",
        isActive: true,
        createdAt: new Date(),
      }
    );

    // Seed test categories
    memoryAdminStore.categories.push({
      _id: "64f1a2b3c4d5e6f7a8b9c001",
      id: "64f1a2b3c4d5e6f7a8b9c001",
      name: "electronics",
      createdAt: new Date(),
    });

    // Seed test products
    memoryAdminStore.products.push(
      {
        _id: "64f2b1a2b3c4d5e6f7a8b001",
        id: "64f2b1a2b3c4d5e6f7a8b001",
        productName: "Mechanical Gaming Keyboard",
        sellerName: "KeyCrafters",
        description: "RGB keyboard",
        price: 99.99,
        stock: 5, // low stock!
        category: {
          id: "64f1a2b3c4d5e6f7a8b9c001",
          name: "electronics",
        },
        productImage: "https://example.com/keyboard.jpg",
        isActive: true,
        createdAt: new Date(),
      },
      {
        _id: "64f2b1a2b3c4d5e6f7a8b002",
        id: "64f2b1a2b3c4d5e6f7a8b002",
        productName: "Wireless Gaming Mouse",
        sellerName: "KeyCrafters",
        description: "Ultra-fast sensor",
        price: 49.99,
        stock: 25,
        category: {
          id: "64f1a2b3c4d5e6f7a8b9c001",
          name: "electronics",
        },
        productImage: "https://example.com/mouse.jpg",
        isActive: true,
        createdAt: new Date(),
      }
    );

    // Seed test orders
    memoryAdminStore.orders.push(
      {
        _id: "64f3c1a2b3c4d5e6f7a8b001",
        id: "64f3c1a2b3c4d5e6f7a8b001",
        orderNumber: "ORD-2026-001",
        customerName: "Alice Wonderland",
        customerEmail: "alice@example.com",
        totalAmount: 99.99,
        status: "CONFIRMED",
        orderItems: [{ productName: "Mechanical Gaming Keyboard", quantity: 1 }],
        createdAt: new Date(),
      },
      {
        _id: "64f3c1a2b3c4d5e6f7a8b002",
        id: "64f3c1a2b3c4d5e6f7a8b002",
        orderNumber: "ORD-2026-002",
        customerName: "Regular Customer",
        customerEmail: "customer@example.com",
        totalAmount: 49.99,
        status: "SHIPPED",
        orderItems: [{ productName: "Wireless Gaming Mouse", quantity: 1 }],
        createdAt: new Date(),
      }
    );
  });

  test("GET /api/v1/admin/dashboard rejects unauthenticated requests with 401", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/admin/dashboard`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/admin/dashboard rejects normal CUSTOMER requests with 403 Forbidden", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/admin/dashboard`, {
        headers: customerHeaders,
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /Forbidden/i);
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/admin/dashboard allows ADMIN and returns real aggregated metrics", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/admin/dashboard`, {
        headers: adminHeaders,
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(typeof data.data.totalRevenue, "number");
      assert.strictEqual(data.data.totalProducts >= 2, true);
      assert.strictEqual(data.data.totalOrders >= 2, true);
      assert.strictEqual(data.data.lowStockProducts >= 1, true); // keyboard stock is 5
      assert.strictEqual(typeof data.data.ordersByStatus, "object");
      assert.strictEqual(data.data.ordersByStatus.CONFIRMED >= 1, true);
      assert.strictEqual(data.data.ordersByStatus.SHIPPED >= 1, true);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/admin/products creates product with validation and logs audit", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // 1. Validation failure: missing name
      const failRes = await fetch(`http://localhost:${port}/api/v1/admin/products`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          price: 50,
          category: "64f1a2b3c4d5e6f7a8b9c001",
        }),
      });
      assert.strictEqual(failRes.status, 400);

      // 2. Successful creation
      const successRes = await fetch(
        `http://localhost:${port}/api/v1/admin/products`,
        {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({
            productName: "Ultra HD 4K Monitor",
            sellerName: "ScreenVision",
            description: "27 inch IPS display",
            price: 299.99,
            stock: 15,
            category: "64f1a2b3c4d5e6f7a8b9c001",
            productImage: "https://example.com/monitor.jpg",
          }),
        }
      );
      assert.strictEqual(successRes.status, 201);
      const data = await successRes.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.productName, "Ultra HD 4K Monitor");
      assert.strictEqual(data.data.price, 299.99);

      // Verify audit log
      const log = memoryAuditLogs.find(
        (l) => l.action === "PRODUCT_CREATED" && l.details?.productName === "Ultra HD 4K Monitor"
      );
      assert.ok(log, "Audit log for PRODUCT_CREATED should be recorded");
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/admin/products/:id/stock adjusts inventory and prevents negative stock", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const prodId = "64f2b1a2b3c4d5e6f7a8b001"; // stock is 5

      // 1. Rejects subtracting more than available stock
      const overSubtractRes = await fetch(
        `http://localhost:${port}/api/v1/admin/products/${prodId}/stock`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({ quantity: 10, operation: "SUBTRACT" }),
        }
      );
      assert.strictEqual(overSubtractRes.status, 400);

      // 2. Successfully adds stock
      const addRes = await fetch(
        `http://localhost:${port}/api/v1/admin/products/${prodId}/stock`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({ quantity: 15, operation: "ADD" }),
        }
      );
      assert.strictEqual(addRes.status, 200);
      const addData = await addRes.json();
      assert.strictEqual(addData.data.stock, 20); // 5 + 15 = 20

      // Verify audit log
      const stockLog = memoryAuditLogs.find((l) => l.action === "STOCK_UPDATED");
      assert.ok(stockLog);
      assert.strictEqual(stockLog.details.operation, "ADD");
    } finally {
      server.close();
    }
  });

  test("DELETE /api/v1/admin/products/:id soft-deletes product without breaking history", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const prodId = "64f2b1a2b3c4d5e6f7a8b002";
      const delRes = await fetch(
        `http://localhost:${port}/api/v1/admin/products/${prodId}`,
        {
          method: "DELETE",
          headers: adminHeaders,
        }
      );
      assert.strictEqual(delRes.status, 200);

      // Verify soft delete: isActive is false
      const prod = memoryAdminStore.products.find(
        (p) => (p._id || p.id).toString() === prodId
      );
      assert.strictEqual(prod.isActive, false);

      const delLog = memoryAuditLogs.find((l) => l.action === "PRODUCT_DELETED");
      assert.ok(delLog);
    } finally {
      server.close();
    }
  });

  test("DELETE /api/v1/admin/categories/:id prevents deletion when active products exist", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const catId = "64f1a2b3c4d5e6f7a8b9c001"; // keyboard and mouse are in this category
      const res = await fetch(
        `http://localhost:${port}/api/v1/admin/categories/${catId}`,
        {
          method: "DELETE",
          headers: adminHeaders,
        }
      );
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /Cannot delete category.*assigned/i);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/admin/orders/:id/status updates order and enforces valid state machine", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const orderId = "64f3c1a2b3c4d5e6f7a8b001"; // status is CONFIRMED

      // 1. Invalid jump: CONFIRMED -> DELIVERED (must go through PROCESSING and SHIPPED)
      const invalidRes = await fetch(
        `http://localhost:${port}/api/v1/admin/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({ status: "DELIVERED" }),
        }
      );
      assert.strictEqual(invalidRes.status, 400);

      // 2. Valid transition: CONFIRMED -> PROCESSING
      const validRes = await fetch(
        `http://localhost:${port}/api/v1/admin/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({
            status: "PROCESSING",
            note: "Order packaged and awaiting pickup",
          }),
        }
      );
      assert.strictEqual(validRes.status, 200);
      const data = await validRes.json();
      assert.strictEqual(data.data.status, "PROCESSING");
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/admin/users/:id/status prevents self-suspension by admin", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // Attempt to suspend self
      const res = await fetch(
        `http://localhost:${port}/api/v1/admin/users/${adminUser._id}/status`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({ isActive: false }),
        }
      );
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /cannot modify their own status/i);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/admin/users/:id/role updates role and prevents self-demotion", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // 1. Admin demoting self fails
      const selfRes = await fetch(
        `http://localhost:${port}/api/v1/admin/users/${adminUser._id}/role`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({ role: "CUSTOMER" }),
        }
      );
      assert.strictEqual(selfRes.status, 400);

      // 2. Admin promoting customer succeeds
      const promoteRes = await fetch(
        `http://localhost:${port}/api/v1/admin/users/${customerUser._id}/role`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({ role: "ADMIN" }),
        }
      );
      assert.strictEqual(promoteRes.status, 200);
      const data = await promoteRes.json();
      assert.strictEqual(data.data.role, "ADMIN");
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/admin/audit-logs returns audit records and sanitizes sensitive fields", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/admin/audit-logs`, {
        headers: adminHeaders,
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.logs));
      assert.strictEqual(typeof data.data.pagination, "object");
    } finally {
      server.close();
    }
  });
});
