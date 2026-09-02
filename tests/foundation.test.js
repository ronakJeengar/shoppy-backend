import { test, describe } from "node:test";
import assert from "node:assert";
import { User } from "../src/models/user.model.js";
import { Product } from "../src/models/product.model.js";
import { Category } from "../src/models/category.model.js";
import { Order } from "../src/models/order.model.js";
import { ApiError } from "../src/utils/apiError.js";
import { ApiResponse } from "../src/utils/apiResponse.js";
import { asyncHandler } from "../src/utils/asyncHandler.js";
import app from "../src/app.js";

describe("Phase 01 Foundation Verification", () => {
  test("Mongoose models compile cleanly with valid names", () => {
    assert.strictEqual(User.modelName, "User");
    assert.strictEqual(Product.modelName, "Product");
    assert.strictEqual(Category.modelName, "Category");
    assert.strictEqual(Order.modelName, "Order");
  });

  test("ApiError formats error attributes accurately", () => {
    const error = new ApiError(404, "Product not found", [{ field: "id", message: "Invalid ID" }]);
    assert.strictEqual(error.statusCode, 404);
    assert.strictEqual(error.message, "Product not found");
    assert.strictEqual(error.success, false);
    assert.strictEqual(error.errors.length, 1);
  });

  test("ApiResponse formats success envelope correctly", () => {
    const response = new ApiResponse(200, { sample: true }, "Operation successful");
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.success, true);
    assert.strictEqual(response.message, "Operation successful");
    assert.deepStrictEqual(response.data, { sample: true });
  });

  test("asyncHandler propagates asynchronous errors to next()", async () => {
    let capturedError = null;
    const errorToThrow = new Error("Async failure");
    const handler = asyncHandler(async (req, res, next) => {
      throw errorToThrow;
    });

    const mockReq = {};
    const mockRes = {};
    const mockNext = (err) => {
      capturedError = err;
    };

    await handler(mockReq, mockRes, mockNext);
    assert.strictEqual(capturedError, errorToThrow);
  });

  test("Express app responds to /health and returns 200", async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = address.port;

    try {
      const res = await fetch(`http://localhost:${port}/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.statusCode, 200);
    } finally {
      server.close();
    }
  });

  test("Express app responds to unknown route with 404 ApiError", async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = address.port;

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/unknown-endpoint`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.statusCode, 404);
      assert.ok(data.message.includes("Route not found"));
    } finally {
      server.close();
    }
  });
});
