import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { ShippingService } from "../src/services/shipping.service.js";

const JWT_SECRET =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

const adminUser = {
  _id: "64f2b1a2b3c4d5e6f7a8b999",
  email: "admin@shoppy.com",
  role: "ADMIN",
  fullName: "Admin User",
};

const customerUser = {
  _id: "64f2b1a2b3c4d5e6f7a8b001",
  email: "customer@shoppy.com",
  role: "CUSTOMER",
  fullName: "Customer User",
};

const adminToken = jwt.sign(adminUser, JWT_SECRET, { expiresIn: "1h" });
const customerToken = jwt.sign(customerUser, JWT_SECRET, { expiresIn: "1h" });

const adminHeader = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${adminToken}`,
};

const customerHeader = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${customerToken}`,
};

describe("Feature 5: Indian Shipping & PIN-Code Serviceability", () => {
  beforeEach(() => {
    ShippingService.resetMemoryPostalCodes();
  });

  describe("1. PIN Code Validation", () => {
    test("Accepts valid 6-digit Indian PIN codes", () => {
      const validPins = ["560001", "313001", "110001", "400001", "700001"];
      for (const pin of validPins) {
        const result = ShippingService.validatePinCode(pin);
        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.normalizedPin, pin);
        assert.strictEqual(result.error, null);
      }
    });

    test("Normalizes whitespace around valid PIN codes", () => {
      const result = ShippingService.validatePinCode("  560001 \n ");
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.normalizedPin, "560001");
    });

    test("Rejects malformed inputs: letters, symbols, wrong lengths, leading zero", () => {
      const invalidInputs = [
        "",
        null,
        undefined,
        "ABC123",
        "56000",      // 5 digits
        "5600001",    // 7 digits
        "056001",     // starts with 0
        "56 001",     // internal space
        "313-001",    // contains hyphen
        "99999A",
      ];

      for (const input of invalidInputs) {
        const result = ShippingService.validatePinCode(input);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.error);
      }
    });
  });

  describe("2. Public Serviceability API", () => {
    test("GET /api/v1/shipping/serviceability/:pinCode returns serviceability & delivery window for valid PIN", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/shipping/serviceability/560001`);
        assert.strictEqual(res.status, 200);

        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.serviceable, true);
        assert.strictEqual(body.data.pinCode, "560001");
        assert.strictEqual(body.data.city, "Bengaluru");
        assert.strictEqual(body.data.state, "Karnataka");
        assert.strictEqual(body.data.shippingZone, "LOCAL");
        assert.ok(body.data.delivery);
        assert.strictEqual(body.data.delivery.standard.available, true);
        assert.strictEqual(typeof body.data.delivery.standard.minDays, "number");
        assert.strictEqual(typeof body.data.delivery.standard.maxDays, "number");
        assert.strictEqual(body.data.delivery.express.available, true);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/shipping/serviceability/:pinCode returns serviceable: false for unserviceable PIN", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/shipping/serviceability/999999`);
        assert.strictEqual(res.status, 200);

        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.serviceable, false);
        assert.strictEqual(body.data.pinCode, "999999");
        assert.ok(body.data.message.includes("unavailable"));
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/shipping/serviceability/:pinCode rejects malformed PIN format gracefully", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/shipping/serviceability/INVALID`);
        assert.strictEqual(res.status, 200);

        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.serviceable, false);
        assert.ok(body.data.error.includes("Invalid Indian PIN code"));
      } finally {
        server.close();
      }
    });
  });

  describe("3. Authoritative Shipping Quote API", () => {
    test("POST /api/v1/shipping/quote requires pinCode", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/shipping/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subtotal: 500 }),
        });
        assert.strictEqual(res.status, 400);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/shipping/quote charges standard rate when subtotal < free threshold", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/shipping/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pinCode: "313001",
            subtotal: 500.0,
            shippingMethod: "STANDARD",
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.serviceable, true);
        assert.strictEqual(body.data.shippingAmount, 49.0);
        assert.strictEqual(body.data.freeShipping, false);
        assert.strictEqual(body.data.method.code, "STANDARD");
        assert.ok(body.data.amountNeededForFreeShipping > 0);
        assert.strictEqual(body.data.deliveryEstimate.formattedWindow, "3–5 business days");
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/shipping/quote applies free shipping when subtotal >= free threshold", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/shipping/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pinCode: "560001",
            subtotal: 1200.0,
            shippingMethod: "STANDARD",
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.serviceable, true);
        assert.strictEqual(body.data.shippingAmount, 0.0);
        assert.strictEqual(body.data.freeShipping, true);
        assert.strictEqual(body.data.amountNeededForFreeShipping, 0);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/shipping/quote computes express rate accurately", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/shipping/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pinCode: "110001",
            subtotal: 1500.0,
            shippingMethod: "EXPRESS",
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.serviceable, true);
        assert.strictEqual(body.data.method.code, "EXPRESS");
        assert.strictEqual(body.data.shippingAmount, 99.0);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/shipping/quote falls back to STANDARD if express is not available for zone", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        // Leh 194101 has expressAvailable: false
        const res = await fetch(`http://localhost:${port}/api/v1/shipping/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pinCode: "194101",
            subtotal: 400.0,
            shippingMethod: "EXPRESS",
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.serviceable, true);
        assert.strictEqual(body.data.method.code, "STANDARD");
        assert.strictEqual(body.data.shippingZone, "REMOTE");
        // Remote surcharge: 49 + 50 = 99
        assert.strictEqual(body.data.shippingAmount, 99.0);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/shipping/methods returns active shipping methods and threshold", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/shipping/methods`);
        assert.strictEqual(res.status, 200);

        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data.methods));
        assert.ok(body.data.methods.length >= 2);
        assert.strictEqual(body.data.freeShippingThreshold, 999.0);
        assert.strictEqual(body.data.currency, "INR");
      } finally {
        server.close();
      }
    });
  });

  describe("4. Checkout Integration & Order Snapshot", () => {
    test("POST /api/v1/checkout/validate authoritatively computes shipping and attaches shippingDetails snapshot", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/checkout/validate`, {
          method: "POST",
          headers: customerHeader,
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "STANDARD",
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.valid, true);
        assert.ok(body.data.shippingDetails);
        assert.strictEqual(body.data.shippingDetails.method, "STANDARD");
        assert.strictEqual(typeof body.data.shippingDetails.shippingAmount, "number");
        assert.strictEqual(typeof body.data.shippingDetails.shippingZone, "string");
        assert.ok(body.data.shippingDetails.deliveryEstimate);
        assert.strictEqual(typeof body.data.shippingDetails.deliveryEstimate.formattedWindow, "string");
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/checkout/create stores immutable shippingDetails snapshot on order", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/checkout/create`, {
          method: "POST",
          headers: customerHeader,
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "EXPRESS",
            paymentMethod: "COD",
            // Malicious tampering attempt by client
            shippingAmount: 0.0,
            shippingFee: 0.0,
          }),
        });

        assert.strictEqual(res.status, 201);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.data.order);
        assert.strictEqual(body.data.order.shippingMethod, "EXPRESS");
        // Backend overrides manipulated shipping fee
        assert.strictEqual(body.data.order.shippingFee, 99.0);
        assert.ok(body.data.order.shippingDetails);
        assert.strictEqual(body.data.order.shippingDetails.method, "EXPRESS");
        assert.strictEqual(body.data.order.shippingDetails.shippingAmount, 99.0);
        assert.strictEqual(body.data.order.shippingDetails.isFreeShipping, false);
      } finally {
        server.close();
      }
    });
  });

  describe("5. Admin Postal Code & Serviceability Management", () => {
    test("GET /api/v1/admin/shipping/postal-codes rejects unauthenticated requests with 401", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/shipping/postal-codes`);
        assert.strictEqual(res.status, 401);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/admin/shipping/postal-codes rejects non-admin users with 403", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/shipping/postal-codes`, {
          headers: customerHeader,
        });
        assert.strictEqual(res.status, 403);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/admin/shipping/postal-codes allows admin users with 200", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/shipping/postal-codes`, {
          headers: adminHeader,
        });
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data.items));
        assert.ok(body.data.pagination);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/admin/shipping/postal-codes adds/updates postal serviceability", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/shipping/postal-codes`, {
          method: "POST",
          headers: adminHeader,
          body: JSON.stringify({
            pinCode: "302001",
            city: "Jaipur",
            district: "Jaipur",
            state: "Rajasthan",
            stateCode: "RJ",
            isServiceable: true,
            shippingZone: "REGIONAL",
            standardDeliveryMinDays: 3,
            standardDeliveryMaxDays: 4,
            expressAvailable: true,
          }),
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.pinCode, "302001");
        assert.strictEqual(body.data.city, "Jaipur");

        // Verify serviceability check now resolves newly added PIN
        const check = await ShippingService.checkServiceability("302001");
        assert.strictEqual(check.serviceable, true);
        assert.strictEqual(check.city, "Jaipur");
      } finally {
        server.close();
      }
    });
  });
});
