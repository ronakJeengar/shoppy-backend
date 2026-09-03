import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import app from "../src/app.js";
import {
  _registerTestUser,
  _clearTestUsers,
} from "../src/controllers/auth.controller.js";
import {
  _registerTestNotification,
  _clearTestNotifications,
} from "../src/utils/notificationService.js";
import { _clearNotificationState } from "../src/controllers/notification.controller.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

const userA = {
  _id: "64f1a2b3c4d5e6f7a8b9c111",
  id: "64f1a2b3c4d5e6f7a8b9c111",
  email: "alice@example.com",
  fullName: "Alice Walker",
  username: "alice_w",
  role: "CUSTOMER",
  phone: "+1 555-0100",
  notificationPreferences: {
    orderUpdates: true,
    promotions: true,
    wishlistAlerts: true,
  },
};

const userB = {
  _id: "64f1a2b3c4d5e6f7a8b9c222",
  id: "64f1a2b3c4d5e6f7a8b9c222",
  email: "bob@example.com",
  fullName: "Bob Builder",
  username: "bob_b",
  role: "CUSTOMER",
  phone: "+1 555-0200",
  notificationPreferences: {
    orderUpdates: true,
    promotions: true,
    wishlistAlerts: true,
  },
};

const tokenA = jwt.sign(userA, secretKey, { expiresIn: "1h" });
const tokenB = jwt.sign(userB, secretKey, { expiresIn: "1h" });

const authHeaderA = {
  Authorization: `Bearer ${tokenA}`,
  "Content-Type": "application/json",
};

const authHeaderB = {
  Authorization: `Bearer ${tokenB}`,
  "Content-Type": "application/json",
};

describe("Phase 08 Profile, Addresses & Notifications Tests", () => {
  beforeEach(async () => {
    _clearTestUsers();
    _clearNotificationState();

    const hashedPassword = await bcryptjs.hash("secret123", 10);
    _registerTestUser({
      ...userA,
      password: hashedPassword,
    });
    _registerTestUser({
      ...userB,
      password: hashedPassword,
    });

    // Seed test notification for Alice
    _registerTestNotification({
      _id: "notif_alice_1",
      user: userA._id,
      type: "ORDER_CONFIRMED",
      title: "Order Confirmed",
      body: "Your order #ORD-101 has been confirmed.",
      data: { orderId: "ord_101", orderNumber: "ORD-101" },
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    });

    // Seed test notification for Bob
    _registerTestNotification({
      _id: "notif_bob_1",
      user: userB._id,
      type: "PROMOTION",
      title: "Flash Sale!",
      body: "Get 20% off all electronics today.",
      data: {},
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    });
  });

  test("GET /api/v1/auth/me returns current user profile with phone and preferences", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/auth/me`, {
        headers: authHeaderA,
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.email, "alice@example.com");
      assert.strictEqual(body.data.fullName, "Alice Walker");
      assert.strictEqual(body.data.phone, "+1 555-0100");
      assert.strictEqual(body.data.notificationPreferences.orderUpdates, true);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/auth/profile updates profile fields (fullName, phone)", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/auth/profile`, {
        method: "PATCH",
        headers: authHeaderA,
        body: JSON.stringify({
          fullName: "Alice In Wonderland",
          phone: "+1 555-9999",
        }),
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.fullName, "Alice In Wonderland");
      assert.strictEqual(body.data.phone, "+1 555-9999");
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/auth/profile rejects empty fullName with 400", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/auth/profile`, {
        method: "PATCH",
        headers: authHeaderA,
        body: JSON.stringify({
          fullName: "   ",
        }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.message, /cannot be empty/i);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/auth/change-password changes password with valid current password", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/auth/change-password`,
        {
          method: "POST",
          headers: authHeaderA,
          body: JSON.stringify({
            currentPassword: "secret123",
            newPassword: "newsecret456",
          }),
        }
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.accessToken);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/auth/change-password rejects incorrect current password with 401", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/auth/change-password`,
        {
          method: "POST",
          headers: authHeaderA,
          body: JSON.stringify({
            currentPassword: "wrongpassword",
            newPassword: "newsecret456",
          }),
        }
      );
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.message, /Current password is incorrect/i);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/auth/change-password rejects identical password or short password with 400", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Test short password
      const resShort = await fetch(
        `http://localhost:${port}/api/v1/auth/change-password`,
        {
          method: "POST",
          headers: authHeaderA,
          body: JSON.stringify({
            currentPassword: "secret123",
            newPassword: "123",
          }),
        }
      );
      assert.strictEqual(resShort.status, 400);

      // Test same password
      const resSame = await fetch(
        `http://localhost:${port}/api/v1/auth/change-password`,
        {
          method: "POST",
          headers: authHeaderA,
          body: JSON.stringify({
            currentPassword: "secret123",
            newPassword: "secret123",
          }),
        }
      );
      assert.strictEqual(resSame.status, 400);
    } finally {
      server.close();
    }
  });

  test("GET /api/v1/notifications returns user's notification list with unreadCount", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/notifications?page=1&limit=10`,
        {
          headers: authHeaderA,
        }
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.unreadCount, 1);
      assert.strictEqual(body.data.notifications.length, 1);
      assert.strictEqual(body.data.notifications[0].title, "Order Confirmed");
      // Ensure Alice does not see Bob's promotion
      assert.strictEqual(
        body.data.notifications.some((n) => n.title === "Flash Sale!"),
        false
      );
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/notifications/:id/read marks notification as read", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/notifications/notif_alice_1/read`,
        {
          method: "PATCH",
          headers: authHeaderA,
        }
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.isRead, true);
    } finally {
      server.close();
    }
  });

  test("PATCH /api/v1/notifications/:id/read enforces IDOR: Alice cannot mark Bob's notification", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/notifications/notif_bob_1/read`,
        {
          method: "PATCH",
          headers: authHeaderA, // Alice attempting to modify Bob's notification
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

  test("POST /api/v1/notifications/read-all marks all unread notifications as read", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(
        `http://localhost:${port}/api/v1/notifications/read-all`,
        {
          method: "POST",
          headers: authHeaderA,
        }
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.modifiedCount, 1);
    } finally {
      server.close();
    }
  });

  test("POST & DELETE /api/v1/notifications/devices registers and unregisters device token", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Register token
      const regRes = await fetch(
        `http://localhost:${port}/api/v1/notifications/devices`,
        {
          method: "POST",
          headers: authHeaderA,
          body: JSON.stringify({
            deviceToken: "fcm_token_alice_mobile",
            platform: "ANDROID",
          }),
        }
      );
      assert.strictEqual(regRes.status, 200);
      const regBody = await regRes.json();
      assert.strictEqual(regBody.success, true);

      // Unregister token
      const unregRes = await fetch(
        `http://localhost:${port}/api/v1/notifications/devices/fcm_token_alice_mobile`,
        {
          method: "DELETE",
          headers: authHeaderA,
        }
      );
      assert.strictEqual(unregRes.status, 200);
      const unregBody = await unregRes.json();
      assert.strictEqual(unregBody.success, true);
    } finally {
      server.close();
    }
  });

  test("GET & PATCH /api/v1/notifications/preferences retrieves and updates user preferences", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Update preferences
      const patchRes = await fetch(
        `http://localhost:${port}/api/v1/notifications/preferences`,
        {
          method: "PATCH",
          headers: authHeaderA,
          body: JSON.stringify({
            orderUpdates: true,
            promotions: false,
            wishlistAlerts: false,
          }),
        }
      );
      assert.strictEqual(patchRes.status, 200);
      const patchBody = await patchRes.json();
      assert.strictEqual(patchBody.data.promotions, false);

      // Get preferences
      const getRes = await fetch(
        `http://localhost:${port}/api/v1/notifications/preferences`,
        {
          headers: authHeaderA,
        }
      );
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.promotions, false);
      assert.strictEqual(getBody.data.orderUpdates, true);
    } finally {
      server.close();
    }
  });
});
