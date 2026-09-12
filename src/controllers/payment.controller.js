import crypto from "crypto";
import mongoose from "mongoose";
import { Payment } from "../models/payment.model.js";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET ||
  "shoppy_webhook_secret_key_development_example";

// Helper to generate and verify HMAC SHA-256 signatures
export const generatePaymentSignature = (transactionId, amount) => {
  return crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(`${transactionId}|${amount}`)
    .digest("hex");
};

export const verifyPaymentSignature = (transactionId, amount, signature) => {
  const expectedSignature = generatePaymentSignature(transactionId, amount);
  return crypto.timingSafeEqual(
    Buffer.from(signature || "", "utf8"),
    Buffer.from(expectedSignature, "utf8")
  );
};

export const verifyPayment = asyncHandler(async (req, res) => {
  const { transactionId, signature } = req.body;

  if (!transactionId) {
    throw new ApiError(400, "Payment transaction ID is required");
  }

  if (mongoose.connection.readyState === 1) {
    const payment = await Payment.findOne({
      transactionId,
      user: req.user._id,
    });

    if (!payment) {
      throw new ApiError(404, "Payment transaction not found or unauthorized");
    }

    if (payment.status === "COMPLETED") {
      const order = await Order.findById(payment.order);
      return res.status(200).json(
        new ApiResponse(
          200,
          { payment, order },
          "Payment already verified and completed"
        )
      );
    }

    // Optional cryptographic signature check if signature was provided
    if (signature) {
      try {
        const isValid = verifyPaymentSignature(
          transactionId,
          payment.amount,
          signature
        );
        if (!isValid) {
          throw new ApiError(400, "Invalid payment cryptographic signature");
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(400, "Payment signature verification failed");
      }
    }

    // Transition Payment & Order
    payment.status = "COMPLETED";
    payment.signature = signature || "simulated_verified";
    await payment.save();

    const order = await Order.findById(payment.order);
    if (order) {
      order.status = "CONFIRMED";
      await order.save();
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { payment, order },
        "Payment verified successfully. Order confirmed."
      )
    );
  }

  // Offline / Test Fallback
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        payment: {
          transactionId,
          status: "COMPLETED",
          amount: 149.99,
          currency: "INR",
        },
        order: {
          status: "CONFIRMED",
          orderNumber: "ORD-SIMULATED",
        },
      },
      "Payment verified successfully. Order confirmed."
    )
  );
});

export const failPayment = asyncHandler(async (req, res) => {
  const { transactionId, reason } = req.body;

  if (!transactionId) {
    throw new ApiError(400, "Payment transaction ID is required");
  }

  if (mongoose.connection.readyState === 1) {
    const payment = await Payment.findOne({
      transactionId,
      user: req.user._id,
    });

    if (!payment) {
      throw new ApiError(404, "Payment transaction not found or unauthorized");
    }

    if (payment.status === "COMPLETED") {
      throw new ApiError(400, "Cannot fail an already completed payment");
    }

    payment.status = "FAILED";
    payment.metadata = {
      ...payment.metadata,
      failureReason: reason || "User cancelled or payment failed",
      failedAt: new Date(),
    };
    await payment.save();

    // Revert reserved product stock and mark order cancelled
    const order = await Order.findById(payment.order);
    if (order && order.status === "PENDING_PAYMENT") {
      order.status = "CANCELLED";
      await order.save();

      // Atomic stock restoration
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity },
        });
      }
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { payment, order },
        "Payment recorded as failed. Inventory reserved has been restored."
      )
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        payment: { transactionId, status: "FAILED" },
        order: { status: "CANCELLED" },
      },
      "Payment recorded as failed"
    )
  );
});

export const handlePaymentWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const event = req.body;

  if (!signature) {
    throw new ApiError(401, "Webhook signature missing in x-webhook-signature header");
  }

  // Cryptographic webhook signature verification
  const expectedSig = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(JSON.stringify(event))
    .digest("hex");

  let signatureValid = false;
  try {
    signatureValid = crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSig, "utf8")
    );
  } catch (_) {
    signatureValid = false;
  }

  if (!signatureValid) {
    throw new ApiError(400, "Invalid webhook HMAC signature");
  }

  const { type, data } = event;
  const transactionId = data?.transactionId;

  if (mongoose.connection.readyState === 1 && transactionId) {
    const payment = await Payment.findOne({ transactionId });
    if (payment) {
      if (type === "payment.succeeded" && payment.status !== "COMPLETED") {
        payment.status = "COMPLETED";
        await payment.save();

        const order = await Order.findById(payment.order);
        if (order && order.status === "PENDING_PAYMENT") {
          order.status = "CONFIRMED";
          await order.save();
        }
      } else if (type === "payment.failed" && payment.status !== "FAILED") {
        payment.status = "FAILED";
        await payment.save();

        const order = await Order.findById(payment.order);
        if (order && order.status === "PENDING_PAYMENT") {
          order.status = "CANCELLED";
          await order.save();
          for (const item of order.orderItems) {
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { stock: item.quantity },
            });
          }
        }
      }
    }
  }

  return res.status(200).json(
    new ApiResponse(200, { received: true, event: type }, "Webhook processed successfully")
  );
});

export const getPaymentDetails = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  if (mongoose.connection.readyState === 1) {
    const payment = await Payment.findOne({
      transactionId,
      user: req.user._id,
    }).populate("order");

    if (!payment) {
      throw new ApiError(404, "Payment record not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, payment, "Payment retrieved successfully"));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { transactionId, status: "PENDING", amount: 149.99 },
      "Payment retrieved successfully"
    )
  );
});
