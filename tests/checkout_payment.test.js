import { test, describe } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import app from "../src/app.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";
const webhookSecret =
  process.env.PAYMENT_WEBHOOK_SECRET ||
  "shoppy_webhook_secret_key_development_example";

const testUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c888",
  email: "buyer@example.com",
  fullname: "Buyer Doe",
  username: "buyer_doe",
  role: "CUSTOMER",
};

const authToken = jwt.sign(testUser, secretKey, { expiresIn: "1h" });

const authHeader = {
  Authorization: `Bearer ${authToken}`,
  "Content-Type": "application/json",
};

describe("Phase 06 Checkout & Payment Pipeline Tests", () => {
  test("GET /api/v1/addresses rejects unauthenticated requests with 401", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/addresses`);
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.success, false);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/addresses creates address and validates required fields", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // 1. Missing fields should return 400
      const invalidRes = await fetch(
        `http://localhost:${port}/api/v1/addresses`,
        {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({ fullName: "Buyer Doe" }),
        }
      );
      assert.strictEqual(invalidRes.status, 400);

      // 2. Valid address creation
      const validRes = await fetch(
        `http://localhost:${port}/api/v1/addresses`,
        {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({
            fullName: "Buyer Doe",
            phone: "+1 555-0199",
            streetAddress: "742 Evergreen Terrace",
            city: "Springfield",
            state: "OR",
            postalCode: "97477",
            country: "US",
            isDefault: true,
          }),
        }
      );
      assert.strictEqual(validRes.status, 201);
      const validBody = await validRes.json();
      assert.strictEqual(validBody.success, true);
      assert.ok(validBody.data._id);
      assert.strictEqual(validBody.data.city, "Springfield");
      assert.strictEqual(validBody.data.isDefault, true);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/checkout/validate rejects unauthenticated requests with 401", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/checkout/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addressId: "addr_123" }),
        }
      );
      assert.strictEqual(res.status, 401);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/checkout/validate authoritatively computes totals and shipping rates", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Standard shipping
      const standardRes = await fetch(
        `http://localhost:${port}/api/v1/checkout/validate`,
        {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "STANDARD",
          }),
        }
      );

      assert.strictEqual(standardRes.status, 200);
      const standardBody = await standardRes.json();
      assert.strictEqual(standardBody.success, true);
      assert.ok(standardBody.data.subtotal > 0);
      assert.strictEqual(typeof standardBody.data.tax, "number");
      assert.strictEqual(typeof standardBody.data.grandTotal, "number");
      assert.strictEqual(standardBody.data.shippingMethod, "STANDARD");

      // Express shipping
      const expressRes = await fetch(
        `http://localhost:${port}/api/v1/checkout/validate`,
        {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "EXPRESS",
          }),
        }
      );

      assert.strictEqual(expressRes.status, 200);
      const expressBody = await expressRes.json();
      assert.strictEqual(expressBody.data.shippingFee, 9.99);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/checkout/create generates order, payment, and snapshot", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/checkout/create`,
        {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "STANDARD",
            paymentMethod: "CARD",
          }),
        }
      );

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.order);
      assert.ok(body.data.order.orderNumber.startsWith("ORD-"));
      assert.ok(body.data.order.orderItems.length > 0);
      assert.ok(body.data.order.shippingAddress);
      assert.strictEqual(body.data.order.status, "PENDING_PAYMENT");
      assert.ok(body.data.payment);
      assert.strictEqual(body.data.payment.status, "PENDING");
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/checkout/create enforces idempotency on repeated requests", async () => {
    const server = app.listen(0);
    const port = server.address().port;
    const testIdempotencyKey = `idem_test_${Date.now()}`;

    try {
      const firstRes = await fetch(
        `http://localhost:${port}/api/v1/checkout/create`,
        {
          method: "POST",
          headers: {
            ...authHeader,
            "Idempotency-Key": testIdempotencyKey,
          },
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "STANDARD",
            paymentMethod: "CARD",
          }),
        }
      );

      assert.strictEqual(firstRes.status, 201);
      const firstBody = await firstRes.json();
      const firstOrderNumber = firstBody.data.order.orderNumber;

      // Duplicate request with the exact same Idempotency-Key
      const secondRes = await fetch(
        `http://localhost:${port}/api/v1/checkout/create`,
        {
          method: "POST",
          headers: {
            ...authHeader,
            "Idempotency-Key": testIdempotencyKey,
          },
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "STANDARD",
            paymentMethod: "CARD",
          }),
        }
      );

      assert.strictEqual(secondRes.status, 200);
      const secondBody = await secondRes.json();
      assert.strictEqual(secondBody.data.order.orderNumber, firstOrderNumber);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/payments/verify confirms payment and transitions order to CONFIRMED", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/payments/verify`,
        {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({
            transactionId: "txn_simulated_999",
          }),
        }
      );

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.payment.status, "COMPLETED");
      assert.strictEqual(body.data.order.status, "CONFIRMED");
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/payments/fail records failure and marks order CANCELLED", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/payments/fail`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({
          transactionId: "txn_simulated_fail_111",
          reason: "Card expired or insufficient funds",
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.payment.status, "FAILED");
      assert.strictEqual(body.data.order.status, "CANCELLED");
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/payments/webhook rejects requests with missing or invalid signature", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // 1. Missing signature
      const missingRes = await fetch(
        `http://localhost:${port}/api/v1/payments/webhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "payment.succeeded", data: {} }),
        }
      );
      assert.strictEqual(missingRes.status, 401);

      // 2. Invalid signature
      const invalidRes = await fetch(
        `http://localhost:${port}/api/v1/payments/webhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-signature": "tampered_signature_payload",
          },
          body: JSON.stringify({ type: "payment.succeeded", data: {} }),
        }
      );
      assert.strictEqual(invalidRes.status, 400);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/payments/webhook succeeds with valid HMAC SHA-256 signature", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    const payload = {
      type: "payment.succeeded",
      data: {
        transactionId: "txn_webhook_test",
        amount: 149.99,
      },
    };

    const validSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(payload))
      .digest("hex");

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/payments/webhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-signature": validSignature,
          },
          body: JSON.stringify(payload),
        }
      );

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.event, "payment.succeeded");
    } finally {
      server.close();
    }
  });
});
