import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import {
  _resetMemoryAppConfig,
  memoryAppConfig,
} from "../src/controllers/app_config.controller.js";
import { memoryAuditLogs } from "../src/utils/auditLogger.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

const customerUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c101",
  id: "64f1a2b3c4d5e6f7a8b9c101",
  email: "customer@example.com",
  fullName: "Regular Customer",
  role: "CUSTOMER",
  isActive: true,
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c999",
  id: "64f1a2b3c4d5e6f7a8b9c999",
  email: "admin@shoppy.com",
  fullName: "Super Admin",
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

describe("Phase 14 App Bootstrap & Remote Configuration Pipeline Tests", () => {
  beforeEach(() => {
    _resetMemoryAppConfig();
    memoryAuditLogs.length = 0;
  });

  test("1. Public GET /api/v1/app/bootstrap succeeds without authentication", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/app/bootstrap`);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.configVersion);
      assert.ok(json.data.features);
      assert.strictEqual(json.data.features.wishlist, true);
      assert.strictEqual(json.data.features.reviews, true);
      assert.strictEqual(json.data.features.productVideo, true);
      assert.strictEqual(json.data.features.product3D, true);
      assert.strictEqual(json.data.features.recommendations, true);
      assert.strictEqual(json.data.features.aiAssistant, true);

      // Verify Commerce display defaults
      assert.strictEqual(json.data.commerce.currency, "INR");
      assert.strictEqual(json.data.commerce.currencySymbol, "₹");
      assert.ok(Array.isArray(json.data.commerce.supportedPaymentMethods));

      // Verify UI Home sections allowlist
      assert.ok(Array.isArray(json.data.ui.homeSections));
      assert.strictEqual(json.data.ui.homeSections.length, 6);
      assert.strictEqual(json.data.ui.homeSections[0].id, "hero_banner");

      // Verify Headers
      assert.ok(res.headers.get("etag"));
      assert.ok(res.headers.get("cache-control").includes("public"));
    } finally {
      server.close();
    }
  });

  test("2. ETag & Conditional Request: Returns 304 Not Modified when If-None-Match matches", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const firstRes = await fetch(
        `http://localhost:${port}/api/v1/app/bootstrap`
      );
      assert.strictEqual(firstRes.status, 200);
      const etag = firstRes.headers.get("etag");
      assert.ok(etag, "ETag header must be returned");

      // Conditional GET request with ETag
      const secondRes = await fetch(
        `http://localhost:${port}/api/v1/app/bootstrap`,
        {
          headers: {
            "If-None-Match": etag,
          },
        }
      );
      assert.strictEqual(secondRes.status, 304);
    } finally {
      server.close();
    }
  });

  test("3. Version Compatibility: Enforces forceUpdateRequired when client version < minimumSupported", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // Minimum is 1.0.0, client sends 0.9.5
      const res = await fetch(`http://localhost:${port}/api/v1/app/bootstrap`, {
        headers: {
          "X-App-Version": "0.9.5",
        },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.appVersion.forceUpdateRequired, true);
      assert.strictEqual(json.data.appVersion.optionalUpdateAvailable, false);
    } finally {
      server.close();
    }
  });

  test("4. Version Compatibility: Flags optionalUpdateAvailable when minimumSupported <= client < latestRecommended", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // Minimum is 1.0.0, Recommended is 1.1.0, client sends 1.0.2
      const res = await fetch(
        `http://localhost:${port}/api/v1/app/bootstrap?clientVersion=1.0.2`
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.appVersion.forceUpdateRequired, false);
      assert.strictEqual(json.data.appVersion.optionalUpdateAvailable, true);
    } finally {
      server.close();
    }
  });

  test("5. Zero Secret Leakage: Public bootstrap config never exposes sensitive credentials or internals", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/app/bootstrap`);
      const body = await res.text();

      assert.ok(!body.includes("password"));
      assert.ok(!body.includes("secret"));
      assert.ok(!body.includes("mongodb"));
      assert.ok(!body.includes("token"));
      assert.ok(!body.includes("privateKey"));
    } finally {
      server.close();
    }
  });

  test("6. Security & RBAC: Admin config endpoints reject unauthenticated and non-admin requests", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // 1. Unauthenticated GET /api/v1/admin/config -> 401
      const unauthGet = await fetch(
        `http://localhost:${port}/api/v1/admin/config`
      );
      assert.strictEqual(unauthGet.status, 401);

      // 2. Unauthenticated PATCH /api/v1/admin/config -> 401
      const unauthPatch = await fetch(
        `http://localhost:${port}/api/v1/admin/config`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ features: { wishlist: false } }),
        }
      );
      assert.strictEqual(unauthPatch.status, 401);

      // 3. Customer GET /api/v1/admin/config -> 403 Forbidden
      const custGet = await fetch(
        `http://localhost:${port}/api/v1/admin/config`,
        {
          headers: customerHeaders,
        }
      );
      assert.strictEqual(custGet.status, 403);

      // 4. Customer PATCH /api/v1/admin/config -> 403 Forbidden
      const custPatch = await fetch(
        `http://localhost:${port}/api/v1/admin/config`,
        {
          method: "PATCH",
          headers: customerHeaders,
          body: JSON.stringify({ features: { wishlist: false } }),
        }
      );
      assert.strictEqual(custPatch.status, 403);
    } finally {
      server.close();
    }
  });

  test("7. Admin Management: Admin can retrieve and update feature flags with validation and audit logging", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      // 1. Admin GET config
      const getRes = await fetch(
        `http://localhost:${port}/api/v1/admin/config`,
        {
          headers: adminHeaders,
        }
      );
      assert.strictEqual(getRes.status, 200);
      const initialJson = await getRes.json();
      assert.strictEqual(initialJson.data.features.aiAssistant, true);

      // 2. Validation check: Reject invalid section id
      const invalidSectionRes = await fetch(
        `http://localhost:${port}/api/v1/admin/config`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({
            ui: {
              homeSections: [
                { id: "dangerous_arbitrary_eval_section", name: "Bad", enabled: true, order: 1 },
              ],
            },
          }),
        }
      );
      assert.strictEqual(invalidSectionRes.status, 400);

      // 3. Validation check: Reject invalid semver
      const invalidSemverRes = await fetch(
        `http://localhost:${port}/api/v1/admin/config`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({
            appVersion: { minimumSupported: "invalid_not_semver" },
          }),
        }
      );
      assert.strictEqual(invalidSemverRes.status, 400);

      // 4. Admin update: Disable AI Assistant and enable maintenance mode
      const patchRes = await fetch(
        `http://localhost:${port}/api/v1/admin/config`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({
            features: {
              aiAssistant: false,
              product3D: false,
            },
            maintenance: {
              enabled: true,
              message: "Under emergency maintenance. Back in 30 mins.",
            },
            appVersion: {
              minimumSupported: "1.2.0",
            },
          }),
        }
      );
      assert.strictEqual(patchRes.status, 200);
      const patchJson = await patchRes.json();
      assert.strictEqual(patchJson.data.features.aiAssistant, false);
      assert.strictEqual(patchJson.data.features.product3D, false);
      assert.strictEqual(patchJson.data.maintenance.enabled, true);

      // 5. Verify audit log was produced
      assert.strictEqual(memoryAuditLogs.length, 1);
      assert.strictEqual(memoryAuditLogs[0].action, "UPDATE_APP_CONFIG");
      assert.strictEqual(memoryAuditLogs[0].resourceType, "SYSTEM");

      // 6. Verify subsequent public bootstrap request reflects updated remote config
      const bootstrapRes = await fetch(
        `http://localhost:${port}/api/v1/app/bootstrap?clientVersion=1.0.0`
      );
      const bootstrapJson = await bootstrapRes.json();
      assert.strictEqual(bootstrapJson.data.features.aiAssistant, false);
      assert.strictEqual(bootstrapJson.data.features.product3D, false);
      assert.strictEqual(bootstrapJson.data.maintenance.enabled, true);
      assert.strictEqual(bootstrapJson.data.maintenance.message, "Under emergency maintenance. Back in 30 mins.");
      assert.strictEqual(bootstrapJson.data.appVersion.forceUpdateRequired, true);
    } finally {
      server.close();
    }
  });
});
