import { test, describe } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import { User } from "../src/models/user.model.js";
import { verifyJWT, requireRole } from "../src/middlewares/auth.middleware.js";
import app from "../src/app.js";

describe("Phase 02 Authentication & Identity Tests", () => {
  const secretKey =
    process.env.ACCESS_TOKEN_KEY ||
    "shoppy_access_token_secret_key_development_example";

  test("User model generates valid JWT access and refresh tokens", () => {
    const mockUser = new User({
      username: "testuser",
      email: "test@example.com",
      fullName: "Test User",
      password: "hashed_password_123",
      role: "CUSTOMER",
    });

    const accessToken = mockUser.generateAccessToken();
    assert.ok(accessToken, "Access token should be generated");

    const decoded = jwt.verify(accessToken, secretKey);
    assert.strictEqual(decoded.username, "testuser");
    assert.strictEqual(decoded.email, "test@example.com");
    assert.strictEqual(decoded.fullName, "Test User");
    assert.strictEqual(decoded.role, "CUSTOMER");

    const refreshToken = mockUser.generateRefreshToken();
    assert.ok(refreshToken, "Refresh token should be generated");
  });

  test("Registration endpoint rejects missing required fields with 400", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid", password: "123" }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.statusCode, 400);
      assert.ok(data.message.includes("Name is required") || data.message.includes("name is required"));
    } finally {
      server.close();
    }
  });

  test("Registration endpoint rejects invalid email formats with 400", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John", email: "notanemail", password: "ValidPassword123" }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes("valid email"));
    } finally {
      server.close();
    }
  });

  test("Login endpoint rejects missing credentials with 400", async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.statusCode, 400);
    } finally {
      server.close();
    }
  });

  test("verifyJWT rejects unauthenticated requests with 401", async () => {
    let capturedError = null;
    const req = { header: () => null, cookies: {} };
    const res = {};
    const next = (err) => {
      capturedError = err;
    };

    await verifyJWT(req, res, next);
    assert.ok(capturedError, "Should produce an error");
    assert.strictEqual(capturedError.statusCode, 401);
    assert.ok(capturedError.message.includes("Authentication token is missing"));
  });

  test("verifyJWT rejects invalid token signature with 401", async () => {
    let capturedError = null;
    const req = { header: (h) => (h === "Authorization" ? "Bearer invalid.token.payload" : null), cookies: {} };
    const res = {};
    const next = (err) => {
      capturedError = err;
    };

    await verifyJWT(req, res, next);
    assert.ok(capturedError, "Should produce an error");
    assert.strictEqual(capturedError.statusCode, 401);
    assert.ok(capturedError.message.includes("invalid or expired"));
  });

  test("requireRole allows permitted roles and blocks forbidden roles with 403", () => {
    const customerUser = { role: "CUSTOMER" };
    const adminMiddleware = requireRole(["ADMIN"]);
    const customerMiddleware = requireRole(["CUSTOMER", "ADMIN"]);

    let blockError = null;
    adminMiddleware({ user: customerUser }, {}, (err) => {
      blockError = err;
    });
    assert.ok(blockError, "Customer should be forbidden from admin role");
    assert.strictEqual(blockError.statusCode, 403);

    let allowError = null;
    customerMiddleware({ user: customerUser }, {}, (err) => {
      allowError = err;
    });
    assert.strictEqual(allowError, undefined, "Customer should be permitted");
  });
});
