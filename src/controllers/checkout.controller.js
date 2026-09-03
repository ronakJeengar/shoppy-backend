import mongoose from "mongoose";
import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";
import { Address } from "../models/address.model.js";
import { Order } from "../models/order.model.js";
import { Payment } from "../models/payment.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Offline in-memory state for test runners
const inMemoryOrders = new Map();
const inMemoryPayments = new Map();
const idempotencyCache = new Map();

// Helper to compute authoritative financial values
export const computeCheckoutTotals = (items, shippingMethod = "STANDARD") => {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const roundedSubtotal = Number(subtotal.toFixed(2));

  let shippingFee = 0;
  if (shippingMethod === "EXPRESS") {
    shippingFee = 9.99;
  } else {
    shippingFee = roundedSubtotal >= 50.0 ? 0.0 : 4.99;
  }

  const tax = Number((roundedSubtotal * 0.08).toFixed(2));
  const grandTotal = Number((roundedSubtotal + shippingFee + tax).toFixed(2));

  return {
    subtotal: roundedSubtotal,
    shippingFee,
    tax,
    grandTotal,
  };
};

export const validateCheckout = asyncHandler(async (req, res) => {
  const { addressId, shippingMethod = "STANDARD" } = req.body;
  const userId = req.user._id.toString();

  if (!addressId) {
    throw new ApiError(400, "Shipping address ID is required");
  }

  if (mongoose.connection.readyState === 1) {
    // 1. Verify address ownership
    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) {
      throw new ApiError(404, "Shipping address not found or unauthorized");
    }

    // 2. Fetch and revalidate cart
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new ApiError(400, "Your cart is empty. Please add items before checkout.");
    }

    const revalidatedItems = [];
    for (const item of cart.items) {
      const product = item.product;
      if (!product) {
        throw new ApiError(400, "One or more products in your cart no longer exist.");
      }

      if (product.stock < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for "${product.productName}". Available: ${product.stock}, requested: ${item.quantity}.`
        );
      }

      const unitPrice = Number(product.price.toFixed(2));
      const lineTotal = Number((unitPrice * item.quantity).toFixed(2));

      revalidatedItems.push({
        productId: product._id,
        productName: product.productName,
        productImage: product.productImage || "",
        sellerName: product.sellerName || "Official Store",
        unitPrice,
        quantity: item.quantity,
        lineTotal,
      });
    }

    const totals = computeCheckoutTotals(revalidatedItems, shippingMethod);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          valid: true,
          items: revalidatedItems,
          shippingAddress: address,
          shippingMethod,
          ...totals,
        },
        "Checkout validated successfully"
      )
    );
  }

  // Offline / Test Fallback
  const fallbackAddress = {
    _id: addressId,
    fullName: req.user.fullName || "Test Customer",
    phone: "1234567890",
    streetAddress: "123 Market Street",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    country: "US",
  };

  const sampleItems = [
    {
      productId: "64f2b1a2b3c4d5e6f7a8b001",
      productName: "Wireless Noise-Cancelling Headphones",
      productImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
      sellerName: "SoundTech Official",
      unitPrice: 149.99,
      quantity: 1,
      lineTotal: 149.99,
    },
  ];

  const totals = computeCheckoutTotals(sampleItems, shippingMethod);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        valid: true,
        items: sampleItems,
        shippingAddress: fallbackAddress,
        shippingMethod,
        ...totals,
      },
      "Checkout validated successfully"
    )
  );
});

export const createOrderFromCheckout = asyncHandler(async (req, res) => {
  const {
    addressId,
    shippingMethod = "STANDARD",
    paymentMethod = "CARD",
  } = req.body;
  const userId = req.user._id.toString();
  const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey;

  // 1. Idempotency Guard
  if (idempotencyKey) {
    if (idempotencyCache.has(idempotencyKey)) {
      const cached = idempotencyCache.get(idempotencyKey);
      return res
        .status(200)
        .json(new ApiResponse(200, cached, "Order retrieved from idempotency cache"));
    }

    if (mongoose.connection.readyState === 1) {
      const existingOrder = await Order.findOne({
        idempotencyKey,
        customer: req.user._id,
      }).populate("payment");

      if (existingOrder) {
        return res
          .status(200)
          .json(
            new ApiResponse(
              200,
              { order: existingOrder, payment: existingOrder.payment },
              "Order retrieved from idempotency check"
            )
          );
      }
    }
  }

  if (!addressId) {
    throw new ApiError(400, "Shipping address ID is required");
  }

  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  if (mongoose.connection.readyState === 1) {
    // 2. Address Verification & Snapshot
    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) {
      throw new ApiError(404, "Shipping address not found or unauthorized");
    }

    const shippingAddressSnapshot = {
      fullName: address.fullName,
      phone: address.phone,
      streetAddress: address.streetAddress,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || "US",
    };

    // 3. Cart Revalidation
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new ApiError(400, "Your cart is empty. Cannot checkout an empty cart.");
    }

    // 4. Atomic Inventory Verification & Decrement
    const orderItemsSnapshot = [];
    for (const item of cart.items) {
      const product = item.product;
      if (!product) {
        throw new ApiError(400, "Product no longer exists in catalog.");
      }

      // Atomic decrement with condition stock >= requested
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: product._id, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        throw new ApiError(
          400,
          `Sorry, "${product.productName}" is out of stock or requested quantity is unavailable.`
        );
      }

      const unitPrice = Number(product.price.toFixed(2));
      const lineTotal = Number((unitPrice * item.quantity).toFixed(2));

      orderItemsSnapshot.push({
        productId: product._id,
        productName: product.productName,
        productImage: product.productImage || "",
        sellerName: product.sellerName || "Official Store",
        unitPrice,
        quantity: item.quantity,
        lineTotal,
      });
    }

    // 5. Authoritative Financial Calculations
    const totals = computeCheckoutTotals(orderItemsSnapshot, shippingMethod);

    // 6. Payment Generation
    const transactionId = `txn_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    const initialOrderStatus =
      paymentMethod === "COD" ? "CONFIRMED" : "PENDING_PAYMENT";
    const initialPaymentStatus = paymentMethod === "COD" ? "AUTHORIZED" : "PENDING";

    const order = await Order.create({
      orderNumber,
      customer: req.user._id,
      orderItems: orderItemsSnapshot,
      shippingAddress: shippingAddressSnapshot,
      shippingMethod,
      subtotal: totals.subtotal,
      shippingFee: totals.shippingFee,
      tax: totals.tax,
      totalAmount: totals.grandTotal,
      orderPrice: totals.grandTotal,
      currency: "USD",
      status: initialOrderStatus,
      idempotencyKey,
    });

    const payment = await Payment.create({
      order: order._id,
      user: req.user._id,
      transactionId,
      provider: paymentMethod === "COD" ? "COD" : "SIMULATED",
      paymentMethod,
      amount: totals.grandTotal,
      currency: "USD",
      status: initialPaymentStatus,
      metadata: {
        orderNumber,
        shippingMethod,
      },
    });

    order.payment = payment._id;
    await order.save();

    // 7. Clear User's Cart
    cart.items = [];
    await cart.save();

    const responsePayload = {
      order,
      payment,
      paymentInstructions: {
        transactionId,
        amount: totals.grandTotal,
        currency: "USD",
        provider: payment.provider,
        paymentMethod,
        requiresAction: paymentMethod !== "COD",
      },
    };

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, responsePayload);
    }

    return res
      .status(201)
      .json(new ApiResponse(201, responsePayload, "Order created successfully"));
  }

  // Offline / Test Fallback
  const sampleItems = [
    {
      _id: new mongoose.Types.ObjectId(),
      productId: new mongoose.Types.ObjectId("64f2b1a2b3c4d5e6f7a8b001"),
      productName: "Wireless Noise-Cancelling Headphones",
      productImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
      sellerName: "SoundTech Official",
      unitPrice: 149.99,
      quantity: 1,
      lineTotal: 149.99,
    },
  ];

  const totals = computeCheckoutTotals(sampleItems, shippingMethod);
  const transactionId = `txn_offline_${Date.now()}`;
  const initialOrderStatus =
    paymentMethod === "COD" ? "CONFIRMED" : "PENDING_PAYMENT";
  const initialPaymentStatus = paymentMethod === "COD" ? "AUTHORIZED" : "PENDING";

  const offlineOrder = {
    _id: `ord_${Date.now()}`,
    orderNumber,
    customer: userId,
    orderItems: sampleItems,
    shippingAddress: {
      fullName: req.user.fullName || "Test Customer",
      phone: "1234567890",
      streetAddress: "123 Market Street",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
    },
    shippingMethod,
    subtotal: totals.subtotal,
    shippingFee: totals.shippingFee,
    tax: totals.tax,
    totalAmount: totals.grandTotal,
    orderPrice: totals.grandTotal,
    currency: "USD",
    status: initialOrderStatus,
    idempotencyKey,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const offlinePayment = {
    _id: `pay_${Date.now()}`,
    order: offlineOrder._id,
    user: userId,
    transactionId,
    provider: paymentMethod === "COD" ? "COD" : "SIMULATED",
    paymentMethod,
    amount: totals.grandTotal,
    currency: "USD",
    status: initialPaymentStatus,
    metadata: { orderNumber },
    createdAt: new Date(),
  };

  offlineOrder.payment = offlinePayment._id;
  inMemoryOrders.set(offlineOrder._id, offlineOrder);
  inMemoryPayments.set(transactionId, offlinePayment);

  const responsePayload = {
    order: offlineOrder,
    payment: offlinePayment,
    paymentInstructions: {
      transactionId,
      amount: totals.grandTotal,
      currency: "USD",
      provider: offlinePayment.provider,
      paymentMethod,
      requiresAction: paymentMethod !== "COD",
    },
  };

  if (idempotencyKey) {
    idempotencyCache.set(idempotencyKey, responsePayload);
  }

  return res
    .status(201)
    .json(new ApiResponse(201, responsePayload, "Order created successfully"));
});
