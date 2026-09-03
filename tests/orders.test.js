import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import {
  _registerTestOrder,
  _clearTestOrders,
} from "../src/controllers/order.controller.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

const userA = {
  _id: "64f1a2b3c4d5e6f7a8b9c111",
  email: "usera@example.com",
  fullname: "Alice Walker",
  username: "alice_w",
  role: "CUSTOMER",
};

const userB = {
  _id: "64f1a2b3c4d5e6f7a8b9c222",
  email: "userb@example.com",
  fullname: "Bob Builder",
  username: "bob_b",
  role: "CUSTOMER",
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c999",
  email: "admin@shoppy.com",
  fullname: "Admin Super",
  username: "admin_super",
  role: "ADMIN",
};

const tokenA = jwt.sign(userA, secretKey, { expiresIn: "1h" });
const tokenB = jwt.sign(userB, secretKey, { expiresIn: "1h" });
const tokenAdmin = jwt.sign(adminUser, secretKey, { expiresIn: "1h" });

const authHeaderA = {
  Authorization: `Bearer ${tokenA}`,
  "Content-Type": "application/json",
};

const authHeaderB = {
  Authorization: `Bearer ${tokenB}`,
  "Content-Type": "application/json",
};

const authHeaderAdmin = {
  Authorization: `Bearer ${tokenAdmin}`,
  "Content-Type": "application/json",
};

describe("Phase 07 Orders & Order Management Pipeline Tests", () => {
  beforeEach(() => {
    _clearTestOrders();

    // Seed test orders for User A
    _registerTestOrder({
      _id: "ord_alice_101",
      orderNumber: "ORD-ALICE-101",
      customer: userA._id,
      status: "CONFIRMED",
      orderItems: [
        {
          productId: "64f2b1a2b3c4d5e6f7a8b001",
          productName: "Mechanical Keyboard",
          unitPrice: 89.99,
          quantity: 1,
          lineTotal: 89.99,
        },
      ],
      shippingAddress: {
        fullName: "Alice Walker",
        phone: "+1 555-0100",
        streetAddress: "100 Pine Street",
        city: "San Francisco",
        state: "CA",
        postalCode: "94111",
        country: "US",
      },
      subtotal: 89.99,
      shippingFee: 0.0,
      tax: 7.2,
      totalAmount: 97.19,
      payment: {
        _id: "pay_alice_101",
        status: "COMPLETED",
        paymentMethod: "CARD",
        transactionId: "txn_alice_101",
      },
      createdAt: new Date(),
    });

    _registerTestOrder({
      _id: "ord_alice_shipped",
      orderNumber: "ORD-ALICE-SHIPPED",
      customer: userA._id,
      status: "SHIPPED",
      carrier: "FedEx",
      trackingNumber: "TRK-12345",
      orderItems: [
        {
          productId: "64f2b1a2b3c4d5e6f7a8b002",
          productName: "USB-C Hub",
          unitPrice: 29.99,
          quantity: 1,
          lineTotal: 29.99,
        },
      ],
      shippingAddress: {
        fullName: "Alice Walker",
        phone: "+1 555-0100",
        streetAddress: "100 Pine Street",
        city: "San Francisco",
        state: "CA",
        postalCode: "94111",
        country: "US",
      },
      subtotal: 29.99,
      shippingFee: 4.99,
      tax: 2.4,
      totalAmount: 37.38,
      payment: {
        _id: "pay_alice_shipped",
        status: "COMPLETED",
        paymentMethod: "UPI",
        transactionId: "txn_alice_shipped",
      },
      createdAt: new Date(),
    });

    // Seed test order for User B
    _registerTestOrder({
      _id: "ord_bob_201",
      orderNumber: "ORD-BOB-201",
      customer: userB._id,
      status: "CONFIRMED",
      orderItems: [
        {
          productId: "64f2b1a2b3c4d5e6f7a8b003",
          productName: "Studio Monitor Speakers",
          unitPrice: 199.99,
          quantity: 1,
          lineTotal: 199.99,
        },
      ],
      shippingAddress: {
        fullName: "Bob Builder",
        phone: "+1 555-0200",
        streetAddress: "200 Oak Avenue",
        city: "Oakland",
        state: "CA",
        postalCode: "94612",
        country: "US",
      },
      subtotal: 199.99,
      shippingFee: 0.0,
      tax: 16.0,
      totalAmount: 215.99,
      payment: {
        _id: "pay_bob_201",
        status: "COMPLETED",
        paymentMethod: "CARD",
        transactionId: "txn_bob_201",
      },
      createdAt: new Date(),
    });
  });

  test("GET /api/v1/orders rejects unauthenticated requests with 401", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/orders`);
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.success, false);
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/orders returns paginated order list for authenticated user", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/orders?page=1&limit=10`,
        {
          headers: authHeaderA,
        }
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.orders));
      assert.strictEqual(body.data.page, 1);
      assert.ok(body.data.totalOrders >= 2);
      // Ensure Alice only sees her own orders
      for (const order of body.data.orders) {
        assert.strictEqual(order.customer.toString(), userA._id);
      }
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/orders/:id retrieves own order with item snapshots and payment", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/orders/ord_alice_101`,
        {
          headers: authHeaderA,
        }
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.orderNumber, "ORD-ALICE-101");
      assert.strictEqual(body.data.status, "CONFIRMED");
      assert.strictEqual(body.data.canCancel, true);
      assert.ok(body.data.orderItems.length > 0);
      assert.strictEqual(body.data.orderItems[0].productName, "Mechanical Keyboard");
      assert.strictEqual(body.data.shippingAddress.city, "San Francisco");
      assert.strictEqual(body.data.payment.status, "COMPLETED");
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/orders/:id enforces IDOR protection: User A cannot view User B's order", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/orders/ord_bob_201`,
        {
          headers: authHeaderA, // Alice attempting to read Bob's order
        }
      );
      assert.strictEqual(res.status, 404);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.message, /not found or unauthorized/i);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/orders/:id/cancel allows user to cancel own CONFIRMED order and triggers refund", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/orders/ord_alice_101/cancel`,
        {
          method: "POST",
          headers: authHeaderA,
          body: JSON.stringify({ reason: "Found a better deal" }),
        }
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.order.status, "CANCELLED");
      assert.strictEqual(body.data.paymentStatus, "REFUNDED");
      assert.strictEqual(body.data.order.cancellationReason, "Found a better deal");
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/orders/:id/cancel enforces IDOR protection: User A cannot cancel User B's order", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/orders/ord_bob_201/cancel`,
        {
          method: "POST",
          headers: authHeaderA, // Alice attempting to cancel Bob's order
          body: JSON.stringify({ reason: "Malicious cancellation attempt" }),
        }
      );
      assert.strictEqual(res.status, 404);
      const body = await res.json();
      assert.strictEqual(body.success, false);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/orders/:id/cancel rejects cancellation if order has SHIPPED", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/orders/ord_alice_shipped/cancel`,
        {
          method: "POST",
          headers: authHeaderA,
          body: JSON.stringify({ reason: "No longer needed" }),
        }
      );
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.message, /Cannot cancel order with current status 'SHIPPED'/i);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/orders/:id/status rejects non-admin users with 403", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/orders/ord_alice_101/status`,
        {
          method: "PATCH",
          headers: authHeaderA, // Customer attempting admin action
          body: JSON.stringify({ status: "DELIVERED" }),
        }
      );
      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.success, false);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/orders/:id/status allows admin to transition CONFIRMED -> PROCESSING", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/orders/ord_alice_101/status`,
        {
          method: "PATCH",
          headers: authHeaderAdmin,
          body: JSON.stringify({
            status: "PROCESSING",
            note: "Items picked from warehouse shelf",
          }),
        }
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.status, "PROCESSING");
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/orders/:id/status blocks invalid state transitions (SHIPPED -> PROCESSING) with 400", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/orders/ord_alice_shipped/status`,
        {
          method: "PATCH",
          headers: authHeaderAdmin,
          body: JSON.stringify({
            status: "PROCESSING", // Invalid backwards transition from SHIPPED
          }),
        }
      );
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.message, /Invalid status transition/i);
    } finally {
      server.close();
    }
  });
});
