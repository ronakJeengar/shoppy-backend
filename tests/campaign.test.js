import { test, describe } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { CampaignService } from "../src/services/campaign.service.js";

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

describe("Feature 3: Backend-Driven Sale Banner & Campaign System Tests", () => {
  // 1. Service Layer Tests
  describe("Campaign Service Scheduling & Validation", () => {
    test("getActiveCampaigns returns only active, non-expired, non-scheduled campaigns", async () => {
      const activeCampaigns = await CampaignService.getActiveCampaigns({
        now: new Date(),
        limit: 10,
      });

      assert.ok(Array.isArray(activeCampaigns));
      assert.ok(activeCampaigns.length > 0);

      for (const camp of activeCampaigns) {
        assert.strictEqual(camp.isActive, true);
        const s = new Date(camp.startAt).getTime();
        const e = new Date(camp.endAt).getTime();
        const now = Date.now();
        assert.ok(s <= now + 1000, `startAt ${camp.startAt} should be <= now`);
        assert.ok(e >= now - 1000, `endAt ${camp.endAt} should be >= now`);
      }
    });

    test("getActiveCampaigns excludes expired campaigns", async () => {
      const activeCampaigns = await CampaignService.getActiveCampaigns({
        now: new Date(),
      });
      const expired = activeCampaigns.find(
        (c) => c.title.toLowerCase().includes("clearance") || c.id === "camp_expired_clearance"
      );
      assert.strictEqual(expired, undefined, "Expired campaigns must be excluded");
    });

    test("getActiveCampaigns excludes future scheduled campaigns", async () => {
      const activeCampaigns = await CampaignService.getActiveCampaigns({
        now: new Date(),
      });
      const future = activeCampaigns.find(
        (c) => c.title.toLowerCase().includes("sneak peek") || c.id === "camp_scheduled_republic"
      );
      assert.strictEqual(future, undefined, "Future scheduled campaigns must be excluded");
    });

    test("getActiveCampaigns excludes manually disabled campaigns", async () => {
      const activeCampaigns = await CampaignService.getActiveCampaigns({
        now: new Date(),
      });
      const disabled = activeCampaigns.find(
        (c) => c.title.toLowerCase().includes("disabled") || c.id === "camp_inactive_test"
      );
      assert.strictEqual(disabled, undefined, "Deactivated campaigns must be excluded");
    });

    test("Deterministic ordering: priority DESC, displayOrder ASC", async () => {
      const activeCampaigns = await CampaignService.getActiveCampaigns({
        now: new Date(),
      });
      for (let i = 0; i < activeCampaigns.length - 1; i++) {
        const curr = activeCampaigns[i];
        const next = activeCampaigns[i + 1];
        if (curr.priority === next.priority) {
          assert.ok(
            curr.displayOrder <= next.displayOrder,
            `displayOrder should be ascending for equal priority: ${curr.displayOrder} <= ${next.displayOrder}`
          );
        } else {
          assert.ok(
            curr.priority >= next.priority,
            `priority should be descending: ${curr.priority} >= ${next.priority}`
          );
        }
      }
    });

    test("Rejects campaign creation if endAt <= startAt", async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const futureDate = new Date(Date.now() + 86400000);

      await assert.rejects(
        async () => {
          await CampaignService.createCampaign({
            title: "Invalid Dates Campaign",
            bannerImage: "https://example.com/banner.jpg",
            startAt: futureDate,
            endAt: pastDate,
          });
        },
        /endAt must be strictly greater than startAt/i
      );
    });

    test("Rejects invalid campaignType", async () => {
      await assert.rejects(
        async () => {
          await CampaignService.createCampaign({
            title: "Invalid Type Campaign",
            bannerImage: "https://example.com/banner.jpg",
            campaignType: "INVALID_UNKNOWN_TYPE",
            endAt: new Date(Date.now() + 86400000),
          });
        },
        /Invalid campaignType/i
      );
    });

    test("Rejects invalid targetType", async () => {
      await assert.rejects(
        async () => {
          await CampaignService.createCampaign({
            title: "Invalid Target Campaign",
            bannerImage: "https://example.com/banner.jpg",
            targetType: "JAVASCRIPT_INJECTION",
            endAt: new Date(Date.now() + 86400000),
          });
        },
        /Invalid targetType/i
      );
    });
  });

  // 2. Public API Endpoints
  describe("Public Campaign Endpoints", () => {
    test("GET /api/v1/campaigns/active returns 200 with active campaigns list", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/campaigns/active`);
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.ok(Array.isArray(json.data.items));
        assert.ok(json.data.items.length > 0);

        const first = json.data.items[0];
        assert.ok(first.id);
        assert.ok(first.title);
        assert.ok(first.bannerImage);
        assert.ok(first.ctaAction);
        assert.ok(first.ctaAction.type);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/campaigns/active supports limit query parameter", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/campaigns/active?limit=1`);
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.data.items.length, 1);
      } finally {
        server.close();
      }
    });
  });

  // 3. Admin Authorization & CRUD Endpoints
  describe("Admin Campaign Endpoints", () => {
    test("GET /api/v1/admin/campaigns rejects unauthenticated request with 401", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/campaigns`);
        assert.strictEqual(res.status, 401);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/admin/campaigns rejects non-admin customer with 403", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/campaigns`, {
          headers: userHeaders,
        });
        assert.strictEqual(res.status, 403);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/admin/campaigns allows admin with 200", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/campaigns`, {
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

    test("POST /api/v1/admin/campaigns creates a new campaign", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const payload = {
          title: "Admin Created Festival Sale",
          subtitle: "Special limited time festival offer",
          bannerImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f",
          campaignType: "FESTIVAL",
          targetType: "CATEGORY",
          targetId: "electronics",
          ctaLabel: "Shop Deals",
          priority: 12,
          displayOrder: 1,
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 10 * 86400000).toISOString(),
          couponCode: "FESTIVE20",
        };

        const res = await fetch(`http://localhost:${port}/api/v1/admin/campaigns`, {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify(payload),
        });

        assert.strictEqual(res.status, 201);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.data.title, payload.title);
        assert.strictEqual(json.data.campaignType, "FESTIVAL");
        assert.strictEqual(json.data.couponCode, "FESTIVE20");

        const createdId = json.data.id;

        // Update status
        const patchRes = await fetch(
          `http://localhost:${port}/api/v1/admin/campaigns/${createdId}/status`,
          {
            method: "PATCH",
            headers: adminHeaders,
            body: JSON.stringify({ isActive: false }),
          }
        );
        assert.strictEqual(patchRes.status, 200);

        // Delete campaign
        const delRes = await fetch(
          `http://localhost:${port}/api/v1/admin/campaigns/${createdId}`,
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
