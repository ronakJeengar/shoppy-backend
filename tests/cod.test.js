import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { CodService, COD_REASON_CODES } from "../src/services/cod.service.js";
import { _registerTestOrder, _clearTestOrders } from "../src/controllers/order.controller.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

const customerUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c991",
  email: "cod_customer@example.com",
  fullname: "COD Customer",
  username: "cod_customer",
  role: "CUSTOMER",
  isCodBlocked: false,
};

const blockedCustomerUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c992",
  email: "blocked_customer@example.com",
  fullname: "Blocked Customer",
  username: "blocked_customer",
  role: "CUSTOMER",
  isCodBlocked: true,
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c990",
  email: "admin_cod@example.com",
  fullname: "Admin User",
  username: "admin_cod",
  role: "ADMIN",
};

const customerToken = jwt.sign(customerUser, secretKey, { expiresIn: "1h" });
const blockedCustomerToken = jwt.sign(blockedCustomerUser, secretKey, { expiresIn: "1h" });
const adminToken = jwt.sign(adminUser, secretKey, { expiresIn: "1h" });

const customerHeaders = {
  Authorization: `Bearer ${customerToken}`,
  "Content-Type": "application/json",
};

const blockedCustomerHeaders = {
  Authorization: `Bearer ${blockedCustomerToken}`,
  "Content-Type": "application/json",
};

const adminHeaders = {
  Authorization: `Bearer ${adminToken}`,
  "Content-Type": "application/json",
};

describe("Phase 06 Cash on Delivery (COD) System Tests", () => {
  beforeEach(() => {
    CodService._resetMemoryCodConfig();
    _clearTestOrders();
  });

  afterEach(() => {
    CodService._resetMemoryCodConfig();
    _clearTestOrders();
  });

  test("CodService: evaluates eligibility and applies standard fee under threshold", async () => {
    const result = await CodService.evaluateCodEligibility({
      user: customerUser,
      cartItems: [{ productName: "Standard Product", quantity: 1, lineTotal: 799 }],
      subtotal: 799,
      pinCode: "560001",
    });

    assert.strictEqual(result.eligible, true);
    assert.strictEqual(result.fee, 40.0);
    assert.strictEqual(result.isFeeFree, false);
    assert.strictEqual(result.reasonCode, null);
  });

  test("CodService: waives COD fee when subtotal meets or exceeds threshold (₹1499)", async () => {
    const result = await CodService.evaluateCodEligibility({
      user: customerUser,
      cartItems: [{ productName: "Premium Shoes", quantity: 1, lineTotal: 1999 }],
      subtotal: 1999,
      pinCode: "560001",
    });

    assert.strictEqual(result.eligible, true);
    assert.strictEqual(result.fee, 0.0);
    assert.strictEqual(result.isFeeFree, true);
  });

  test("CodService: rejects orders below minimum order value (₹299)", async () => {
    const result = await CodService.evaluateCodEligibility({
      user: customerUser,
      cartItems: [{ productName: "Cable", quantity: 1, lineTotal: 199 }],
      subtotal: 199,
      pinCode: "560001",
    });

    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reasonCode, COD_REASON_CODES.ORDER_VALUE_TOO_LOW);
  });

  test("CodService: rejects orders exceeding maximum order value (₹50,000)", async () => {
    const result = await CodService.evaluateCodEligibility({
      user: customerUser,
      cartItems: [{ productName: "High-end Laptop", quantity: 1, lineTotal: 65000 }],
      subtotal: 65000,
      pinCode: "560001",
    });

    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reasonCode, COD_REASON_CODES.ORDER_VALUE_TOO_HIGH);
  });

  test("CodService: rejects order if customer risk control flag isCodBlocked is true", async () => {
    const result = await CodService.evaluateCodEligibility({
      user: blockedCustomerUser,
      cartItems: [{ productName: "T-Shirt", quantity: 1, lineTotal: 999 }],
      subtotal: 999,
      pinCode: "560001",
    });

    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reasonCode, COD_REASON_CODES.CUSTOMER_BLOCKED);
  });

  test("CodService: rejects order if cart contains non-COD-eligible product", async () => {
    const result = await CodService.evaluateCodEligibility({
      user: customerUser,
      cartItems: [
        { productName: "Digital Gift Card", quantity: 1, lineTotal: 1000, isCodEligible: false },
      ],
      subtotal: 1000,
      pinCode: "560001",
    });

    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reasonCode, COD_REASON_CODES.PRODUCT_NOT_ELIGIBLE);
  });

  test("CodService: rejects order if total item quantity exceeds maximum allowed (10)", async () => {
    const result = await CodService.evaluateCodEligibility({
      user: customerUser,
      cartItems: [{ productName: "Bulk Socks", quantity: 15, lineTotal: 1500 }],
      subtotal: 1500,
      pinCode: "560001",
    });

    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reasonCode, COD_REASON_CODES.LIMIT_EXCEEDED);
  });

  test("CodService: rejects order if global COD switch is disabled", async () => {
    CodService._setMemoryCodConfig({ enabled: false });

    const result = await CodService.evaluateCodEligibility({
      user: customerUser,
      cartItems: [{ productName: "Headphones", quantity: 1, lineTotal: 999 }],
      subtotal: 999,
      pinCode: "560001",
    });

    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reasonCode, COD_REASON_CODES.DISABLED);
  });

  test("POST /api/v1/checkout/validate returns backend-driven payment methods with COD details", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/checkout/validate`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          addressId: "addr_123",
          shippingMethod: "STANDARD",
          paymentMethod: "CARD",
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.paymentMethods));

      const codOption = body.data.paymentMethods.find((p) => p.type === "COD");
      assert.ok(codOption, "COD payment method option must exist");
      assert.strictEqual(typeof codOption.available, "boolean");
      assert.strictEqual(typeof codOption.fee, "number");
      assert.strictEqual(codOption.minOrderValue, 299);
      assert.strictEqual(codOption.maxOrderValue, 50000);

      const cardOption = body.data.paymentMethods.find((p) => p.type === "CARD");
      assert.ok(cardOption, "CARD payment method option must exist");
      assert.strictEqual(cardOption.available, true);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/checkout/validate adds COD fee to grand total when paymentMethod is COD", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Validate with CARD
      const cardRes = await fetch(`http://localhost:${port}/api/v1/checkout/validate`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          addressId: "addr_123",
          shippingMethod: "STANDARD",
          paymentMethod: "CARD",
        }),
      });
      const cardBody = await cardRes.json();
      const cardGrandTotal = cardBody.data.grandTotal;

      // Validate with COD (where subtotal is around 12999 so COD fee is 0 because >= 1499)
      // Let's test by setting freeAboveAmount to 20000 to verify fee addition
      CodService._setMemoryCodConfig({ freeAboveAmount: 20000, fee: 40 });

      const codRes = await fetch(`http://localhost:${port}/api/v1/checkout/validate`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          addressId: "addr_123",
          shippingMethod: "STANDARD",
          paymentMethod: "COD",
        }),
      });

      const codBody = await codRes.json();
      assert.strictEqual(codBody.success, true);
      assert.strictEqual(codBody.data.codFee, 40.0);
      assert.strictEqual(codBody.data.grandTotal, Math.round((cardGrandTotal + 40.0) * 100) / 100);
      assert.strictEqual(codBody.data.codDetails.isCod, true);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/checkout/create creates COD order with PENDING payment status and CONFIRMED order status", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/checkout/create`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          addressId: "addr_123",
          shippingMethod: "STANDARD",
          paymentMethod: "COD",
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const { order, payment, paymentInstructions } = body.data;
      assert.ok(order);
      assert.strictEqual(order.status, "CONFIRMED");
      assert.strictEqual(order.codDetails?.isCod, true);

      assert.ok(payment);
      assert.strictEqual(payment.paymentMethod, "COD");
      assert.strictEqual(payment.status, "PENDING"); // NEVER "AUTHORIZED" or "COMPLETED"
      assert.strictEqual(paymentInstructions.requiresAction, false);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/checkout/create rejects COD if customer is risk-blocked", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/checkout/create`, {
        method: "POST",
        headers: blockedCustomerHeaders,
        body: JSON.stringify({
          addressId: "addr_123",
          shippingMethod: "STANDARD",
          paymentMethod: "COD",
        }),
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.message.includes("unavailable for your account"));
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/payments/verify rejects verification for COD payments", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/payments/verify`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          transactionId: "txn_cod_test_123",
        }),
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.message.includes("Cash on Delivery orders cannot be verified via digital payment gateway"));
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/orders/:id/status transitions COD payment from PENDING to COMPLETED on DELIVERED", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const testOrderId = "ord_cod_delivery_test";
      const testPayment = {
        _id: "pay_cod_123",
        order: testOrderId,
        paymentMethod: "COD",
        provider: "COD",
        status: "PENDING",
        amount: 1499.0,
        currency: "INR",
        metadata: {},
      };

      const testOrder = {
        _id: testOrderId,
        orderNumber: "ORD-COD-DELIV-99",
        customer: customerUser._id,
        status: "SHIPPED",
        payment: testPayment,
        orderItems: [],
        statusHistory: [],
      };

      _registerTestOrder(testOrder);

      const res = await fetch(`http://localhost:${port}/api/v1/orders/${testOrderId}/status`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          status: "DELIVERED",
          note: "Package handed over and cash collected",
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.status, "DELIVERED");
      assert.strictEqual(testPayment.status, "COMPLETED");
      assert.ok(testPayment.metadata?.collectedAt);
    } finally {
      server.close();
    }
  });

  test("GET & PATCH /api/v1/admin/cod/config allows admin to inspect and update COD configuration", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // 1. Get COD config
      const getRes = await fetch(`http://localhost:${port}/api/v1/admin/cod/config`, {
        headers: adminHeaders,
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.success, true);
      assert.strictEqual(getBody.data.fee, 40.0);

      // 2. Update COD config
      const patchRes = await fetch(`http://localhost:${port}/api/v1/admin/cod/config`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          fee: 50.0,
          freeAboveAmount: 1999.0,
          minOrderValue: 499.0,
        }),
      });
      assert.strictEqual(patchRes.status, 200);
      const patchBody = await patchRes.json();
      assert.strictEqual(patchBody.success, true);
      assert.strictEqual(patchBody.data.fee, 50.0);
      assert.strictEqual(patchBody.data.freeAboveAmount, 1999.0);
      assert.strictEqual(patchBody.data.minOrderValue, 499.0);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/admin/users/:id/cod-block allows admin to block or unblock customer COD", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/admin/users/${customerUser._id}/cod-block`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({
            isCodBlocked: true,
          }),
        }
      );

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.isCodBlocked, true);
    } finally {
      server.close();
    }
  });
});
