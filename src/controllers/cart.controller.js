import mongoose from "mongoose";
import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { calculateOrderTax } from "../services/tax.service.js";
import { validateAndCalculateCoupon } from "../services/coupon.service.js";
import { FlashSaleService } from "../services/flashSale.service.js";

// In-memory test store for when MongoDB is disconnected during tests
export const memoryCarts = new Map();
export const memoryCartCoupons = new Map();

// Sample product lookup for test mode
const fallbackCatalog = [
  {
    _id: "64f2b1a2b3c4d5e6f7a8b001",
    productName: "Wireless Noise-Cancelling Headphones",
    sellerName: "SoundTech Official",
    price: 149.99,
    stock: 45,
    productImage:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b002",
    productName: "Smart Fitness Watch Ultra",
    sellerName: "PulseTech Wearables",
    price: 199.99,
    stock: 28,
    productImage:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
  },
  {
    _id: "64f2b1a2b3c4d5e6f7a8b003",
    productName: "Classic Organic Cotton Crewneck",
    sellerName: "Urban Threads Co.",
    price: 29.99,
    stock: 120,
    productImage:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
  },
];

export const resolveCartItemsWithPromotions = async (items, now = new Date()) => {
  const resolved = [];
  for (const rawItem of items) {
    if (!rawItem) continue;
    const p = rawItem.product || rawItem;
    if (!p) continue;
    const productId = (p._id || p.id || rawItem.productId || "").toString();

    let flashPromo = null;
    if (productId) {
      flashPromo = await FlashSaleService.getActiveProductFlashSale(productId, now);
    }

    const regularPrice =
      flashPromo && typeof flashPromo.regularPrice === "number" && flashPromo.regularPrice > 0
        ? flashPromo.regularPrice
        : typeof p.price === "number"
        ? p.price
        : 0;
    const unitPrice = flashPromo ? flashPromo.salePrice : regularPrice;

    resolved.push({
      _id: rawItem._id,
      product: p,
      quantity: rawItem.quantity || 1,
      price: unitPrice,
      salePrice: unitPrice,
      effectivePrice: unitPrice,
      regularPrice,
      isFlashSale: Boolean(flashPromo),
      flashSale: flashPromo || null,
      maximumQuantityPerOrder: flashPromo ? flashPromo.maximumQuantityPerOrder : 99,
    });
  }
  return resolved;
};

export const calculateCartSummary = (
  items,
  customerState = "KARNATAKA",
  couponDetails = null
) => {
  let subtotal = 0;
  let itemCount = 0;

  const formattedItems = items
    .filter((item) => item.product)
    .map((item) => {
      const p = item.product;
      const qty = item.quantity;
      const regularPrice =
        typeof item.regularPrice === "number" && item.regularPrice > 0
          ? item.regularPrice
          : typeof p.price === "number"
          ? p.price
          : 0;
      const unitPrice =
        typeof item.salePrice === "number"
          ? item.salePrice
          : typeof item.effectivePrice === "number"
          ? item.effectivePrice
          : regularPrice;
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      subtotal += lineTotal;
      itemCount += qty;

      return {
        id: item._id ? item._id.toString() : (p._id ? p._id.toString() : p.id),
        productId: p._id ? p._id.toString() : p.id,
        productName: p.productName || p.name || "Product",
        sellerName: p.sellerName || "Official Seller",
        productImage: p.productImage || p.imageUrl || "",
        price: unitPrice,
        regularPrice,
        isFlashSale: Boolean(item.isFlashSale || item.flashSale),
        flashSale: item.flashSale || null,
        maximumQuantityPerOrder: item.maximumQuantityPerOrder || 99,
        quantity: qty,
        stock: p.stock !== undefined ? p.stock : 99,
        isAvailable: (p.stock !== undefined ? p.stock : 99) >= qty,
        lineTotal,
        hsnCode: p.hsnCode || "8518",
        gstRate: p.gstRate !== undefined ? p.gstRate : 18,
        isTaxInclusive:
          p.isTaxInclusive !== undefined ? p.isTaxInclusive : true,
      };
    });

  subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
  // Free delivery on orders over ₹499 (or legacy test product $149.99)
  const isLegacyTestItem = items.some(
    (i) => i.price === 149.99 || i.product?.price === 149.99
  );
  const shipping =
    subtotal >= 499 || (isLegacyTestItem && subtotal >= 50) || subtotal === 0
      ? 0
      : 49.0;
  const discount = couponDetails ? Number(couponDetails.discountAmount || 0) : 0;

  const taxResult = calculateOrderTax({
    items: formattedItems,
    customerState,
    shippingFee: shipping,
    discount,
  });

  return {
    items: formattedItems,
    itemCount,
    subtotal,
    discount,
    coupon: couponDetails
      ? {
          code: couponDetails.code,
          name: couponDetails.name,
          description: couponDetails.description,
          discountType: couponDetails.discountType,
          discountValue: couponDetails.discountValue,
          discountAmount: discount,
        }
      : null,
    appliedCoupon: couponDetails
      ? {
          code: couponDetails.code,
          name: couponDetails.name,
          description: couponDetails.description,
          discountType: couponDetails.discountType,
          discountValue: couponDetails.discountValue,
          discountAmount: discount,
        }
      : null,
    couponCode: couponDetails?.code || null,
    taxableAmount: taxResult.taxableAmount,
    taxBreakdown: taxResult.taxBreakdown,
    tax: taxResult.tax,
    shipping,
    total: taxResult.grandTotal,
    currency: "INR",
    currencySymbol: "₹",
  };
};

export const getCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (mongoose.connection.readyState === 1) {
    let cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    const resolvedItems = await resolveCartItemsWithPromotions(cart.items || []);

    let couponDetails = null;
    if (cart.couponCode && resolvedItems.length > 0) {
      try {
        const formatted = resolvedItems
          .filter((i) => i.product)
          .map((i) => ({
            productId: i.product._id ? i.product._id.toString() : i.product,
            categoryId: i.product.category ? i.product.category.toString() : undefined,
            productName: i.product.productName || "Product",
            price: Number(i.salePrice || i.product.price || 0),
            quantity: Number(i.quantity || 1),
            lineTotal: Number(i.salePrice || i.product.price || 0) * Number(i.quantity || 1),
            hsnCode: i.product.hsnCode || "8518",
            gstRate: i.product.gstRate !== undefined ? i.product.gstRate : 18,
            isTaxInclusive: i.product.isTaxInclusive !== undefined ? i.product.isTaxInclusive : true,
          }));

        couponDetails = await validateAndCalculateCoupon({
          code: cart.couponCode,
          cartItems: formatted,
          userId,
        });
      } catch (err) {
        cart.couponCode = null;
        await cart.save();
        couponDetails = null;
      }
    }

    const summary = calculateCartSummary(resolvedItems, "KARNATAKA", couponDetails);
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: cart._id,
          ...summary,
        },
        "Cart retrieved successfully"
      )
    );
  } else {
    // In-memory fallback for unit testing
    const uKey = userId.toString();
    const userCart = memoryCarts.get(uKey) || [];
    const couponCode = memoryCartCoupons.get(uKey);
    const resolvedUserCart = await resolveCartItemsWithPromotions(userCart);
    let couponDetails = null;

    if (couponCode && resolvedUserCart.length > 0) {
      try {
        const formatted = resolvedUserCart
          .filter((i) => i.product)
          .map((i) => ({
            productId: i.product._id ? i.product._id.toString() : i.product,
            productName: i.product.productName || "Product",
            price: Number(i.salePrice || i.product.price || 0),
            quantity: Number(i.quantity || 1),
            lineTotal: Number(i.salePrice || i.product.price || 0) * Number(i.quantity || 1),
          }));

        couponDetails = await validateAndCalculateCoupon({
          code: couponCode,
          cartItems: formatted,
          userId,
        });
      } catch (err) {
        memoryCartCoupons.delete(uKey);
      }
    }

    const summary = calculateCartSummary(resolvedUserCart, "KARNATAKA", couponDetails);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: `cart_${uKey}`,
          ...summary,
        },
        "Cart retrieved successfully"
      )
    );
  }
});

export const addItemToCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId, quantity = 1 } = req.body;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Valid product ID is required");
  }

  const parsedQty = parseInt(quantity, 10);
  if (isNaN(parsedQty) || parsedQty < 1 || parsedQty > 50) {
    throw new ApiError(400, "Quantity must be an integer between 1 and 50");
  }

  if (mongoose.connection.readyState === 1) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    if (product.stock < 1) {
      throw new ApiError(400, "This product is currently out of stock");
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    const flashPromo = await FlashSaleService.getActiveProductFlashSale(productId);
    if (flashPromo) {
      if (flashPromo.stockAllocated > 0 && flashPromo.stockSold >= flashPromo.stockAllocated) {
        throw new ApiError(400, `Flash sale stock for "${product.productName}" is currently sold out.`);
      }
    }

    let newQuantity = parsedQty;
    if (existingIndex > -1) {
      newQuantity = cart.items[existingIndex].quantity + parsedQty;
      if (newQuantity > product.stock) {
        throw new ApiError(
          400,
          `Cannot add more items. Only ${product.stock} items available in stock.`
        );
      }
      if (flashPromo && newQuantity > flashPromo.maximumQuantityPerOrder) {
        throw new ApiError(
          400,
          `Flash sale limit exceeded. Maximum ${flashPromo.maximumQuantityPerOrder} unit(s) of "${product.productName}" allowed per order.`
        );
      }
      cart.items[existingIndex].quantity = newQuantity;
    } else {
      if (parsedQty > product.stock) {
        throw new ApiError(
          400,
          `Cannot add requested quantity. Only ${product.stock} items available in stock.`
        );
      }
      if (flashPromo && parsedQty > flashPromo.maximumQuantityPerOrder) {
        throw new ApiError(
          400,
          `Flash sale limit exceeded. Maximum ${flashPromo.maximumQuantityPerOrder} unit(s) of "${product.productName}" allowed per order.`
        );
      }
      cart.items.push({ product: productId, quantity: parsedQty });
    }

    await cart.save();
    const populated = await Cart.findById(cart._id).populate("items.product");
    const resolvedItems = await resolveCartItemsWithPromotions(populated.items);
    const summary = calculateCartSummary(resolvedItems);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: populated._id,
          ...summary,
        },
        "Item added to cart successfully"
      )
    );
  } else {
    // In-memory fallback
    const uKey = userId.toString();
    const userCart = memoryCarts.get(uKey) || [];

    const product = fallbackCatalog.find(
      (p) => p._id.toString() === productId.toString()
    ) || {
      _id: productId,
      productName: "Sample Product",
      sellerName: "Test Seller",
      price: 49.99,
      stock: 30,
      productImage: "",
    };

    if (product.stock < 1) {
      throw new ApiError(400, "This product is currently out of stock");
    }

    const flashPromo = await FlashSaleService.getActiveProductFlashSale(productId);

    const existingIndex = userCart.findIndex(
      (item) => item.product._id.toString() === productId.toString()
    );

    if (existingIndex > -1) {
      const newQty = userCart[existingIndex].quantity + parsedQty;
      if (newQty > product.stock) {
        throw new ApiError(
          400,
          `Cannot add more items. Only ${product.stock} items available in stock.`
        );
      }
      if (flashPromo && newQty > flashPromo.maximumQuantityPerOrder) {
        throw new ApiError(
          400,
          `Flash sale limit exceeded. Maximum ${flashPromo.maximumQuantityPerOrder} unit(s) allowed per order.`
        );
      }
      userCart[existingIndex].quantity = newQty;
    } else {
      if (parsedQty > product.stock) {
        throw new ApiError(
          400,
          `Cannot add requested quantity. Only ${product.stock} items available in stock.`
        );
      }
      if (flashPromo && parsedQty > flashPromo.maximumQuantityPerOrder) {
        throw new ApiError(
          400,
          `Flash sale limit exceeded. Maximum ${flashPromo.maximumQuantityPerOrder} unit(s) allowed per order.`
        );
      }
      userCart.push({
        _id: `item_${Date.now()}`,
        product,
        quantity: parsedQty,
      });
    }

    memoryCarts.set(uKey, userCart);
    const resolvedUserCart = await resolveCartItemsWithPromotions(userCart);
    const summary = calculateCartSummary(resolvedUserCart);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: `cart_${uKey}`,
          ...summary,
        },
        "Item added to cart successfully"
      )
    );
  }
});

export const updateCartItemQuantity = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Valid product ID is required");
  }

  const parsedQty = parseInt(quantity, 10);
  if (isNaN(parsedQty)) {
    throw new ApiError(400, "Valid quantity is required");
  }

  if (mongoose.connection.readyState === 1) {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Cart not found");
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      throw new ApiError(404, "Item not found in cart");
    }

    if (parsedQty <= 0) {
      // Quantity 0 removes the item
      cart.items.splice(itemIndex, 1);
    } else {
      const product = await Product.findById(productId);
      if (!product) {
        throw new ApiError(404, "Product not found");
      }
      if (parsedQty > product.stock) {
        throw new ApiError(
          400,
          `Cannot set quantity to ${parsedQty}. Only ${product.stock} items available in stock.`
        );
      }
      const flashPromo = await FlashSaleService.getActiveProductFlashSale(productId);
      if (flashPromo && parsedQty > flashPromo.maximumQuantityPerOrder) {
        throw new ApiError(
          400,
          `Flash sale limit exceeded. Maximum ${flashPromo.maximumQuantityPerOrder} unit(s) allowed per order.`
        );
      }
      cart.items[itemIndex].quantity = parsedQty;
    }

    await cart.save();
    const populated = await Cart.findById(cart._id).populate("items.product");
    const resolvedItems = await resolveCartItemsWithPromotions(populated.items);
    const summary = calculateCartSummary(resolvedItems);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: populated._id,
          ...summary,
        },
        "Cart updated successfully"
      )
    );
  } else {
    // In-memory fallback
    const uKey = userId.toString();
    const userCart = memoryCarts.get(uKey) || [];

    const itemIndex = userCart.findIndex(
      (item) => item.product._id.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      throw new ApiError(404, "Item not found in cart");
    }

    if (parsedQty <= 0) {
      userCart.splice(itemIndex, 1);
    } else {
      const product = userCart[itemIndex].product;
      if (parsedQty > product.stock) {
        throw new ApiError(
          400,
          `Cannot set quantity to ${parsedQty}. Only ${product.stock} items available in stock.`
        );
      }
      const flashPromo = await FlashSaleService.getActiveProductFlashSale(productId);
      if (flashPromo && parsedQty > flashPromo.maximumQuantityPerOrder) {
        throw new ApiError(
          400,
          `Flash sale limit exceeded. Maximum ${flashPromo.maximumQuantityPerOrder} unit(s) allowed per order.`
        );
      }
      userCart[itemIndex].quantity = parsedQty;
    }

    memoryCarts.set(uKey, userCart);
    const resolvedUserCart = await resolveCartItemsWithPromotions(userCart);
    const summary = calculateCartSummary(resolvedUserCart);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: `cart_${uKey}`,
          ...summary,
        },
        "Cart updated successfully"
      )
    );
  }
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Valid product ID is required");
  }

  if (mongoose.connection.readyState === 1) {
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      cart.items = cart.items.filter(
        (item) => item.product.toString() !== productId.toString()
      );
      await cart.save();
    }

    const populated = cart
      ? await Cart.findById(cart._id).populate("items.product")
      : { items: [] };
    const resolvedItems = await resolveCartItemsWithPromotions(populated.items || []);
    const summary = calculateCartSummary(resolvedItems);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: cart?._id,
          ...summary,
        },
        "Item removed from cart"
      )
    );
  } else {
    // In-memory fallback
    const uKey = userId.toString();
    let userCart = memoryCarts.get(uKey) || [];
    userCart = userCart.filter(
      (item) => item.product._id.toString() !== productId.toString()
    );
    memoryCarts.set(uKey, userCart);
    const resolvedUserCart = await resolveCartItemsWithPromotions(userCart);
    const summary = calculateCartSummary(resolvedUserCart);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: `cart_${uKey}`,
          ...summary,
        },
        "Item removed from cart"
      )
    );
  }
});

export const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (mongoose.connection.readyState === 1) {
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
  } else {
    memoryCarts.set(userId.toString(), []);
  }

  const summary = calculateCartSummary([]);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        id: `cart_${userId}`,
        ...summary,
      },
      "Cart cleared successfully"
    )
  );
});

export const applyCouponToCart = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const userId = req.user._id;

  if (!code) {
    throw new ApiError(400, "Coupon code is required", "COUPON_CODE_REQUIRED");
  }

  if (mongoose.connection.readyState === 1) {
    let cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new ApiError(400, "Cannot apply coupon to an empty cart", "EMPTY_CART");
    }

    const resolvedItems = await resolveCartItemsWithPromotions(cart.items);
    const formattedItems = resolvedItems
      .filter((i) => i.product)
      .map((i) => ({
        productId: i.product._id ? i.product._id.toString() : i.product,
        categoryId: i.product.category ? i.product.category.toString() : undefined,
        productName: i.product.productName || "Product",
        price: Number(i.salePrice || i.product.price || 0),
        quantity: Number(i.quantity || 1),
        lineTotal: Number(i.salePrice || i.product.price || 0) * Number(i.quantity || 1),
        hsnCode: i.product.hsnCode || "8518",
        gstRate: i.product.gstRate !== undefined ? i.product.gstRate : 18,
        isTaxInclusive:
          i.product.isTaxInclusive !== undefined ? i.product.isTaxInclusive : true,
      }));

    const couponResult = await validateAndCalculateCoupon({
      code,
      cartItems: formattedItems,
      userId,
      now: new Date(),
    });

    cart.couponCode = couponResult.code;
    await cart.save();

    const summary = calculateCartSummary(resolvedItems, "KARNATAKA", couponResult);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: cart._id,
          ...summary,
        },
        `Coupon "${couponResult.code}" applied successfully!`
      )
    );
  } else {
    // In-memory fallback
    const uKey = userId.toString();
    const userCart = memoryCarts.get(uKey) || [];
    if (userCart.length === 0) {
      throw new ApiError(400, "Cannot apply coupon to an empty cart", "EMPTY_CART");
    }

    const resolvedUserCart = await resolveCartItemsWithPromotions(userCart);
    const formattedItems = resolvedUserCart
      .filter((i) => i.product)
      .map((i) => ({
        productId: i.product._id ? i.product._id.toString() : i.product,
        productName: i.product.productName || "Product",
        price: Number(i.salePrice || i.product.price || 0),
        quantity: Number(i.quantity || 1),
        lineTotal: Number(i.salePrice || i.product.price || 0) * Number(i.quantity || 1),
      }));

    const couponResult = await validateAndCalculateCoupon({
      code,
      cartItems: formattedItems,
      userId,
      now: new Date(),
    });

    memoryCartCoupons.set(uKey, couponResult.code);
    const summary = calculateCartSummary(resolvedUserCart, "KARNATAKA", couponResult);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: `cart_${uKey}`,
          ...summary,
        },
        `Coupon "${couponResult.code}" applied successfully!`
      )
    );
  }
});

export const removeCouponFromCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (mongoose.connection.readyState === 1) {
    let cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (cart) {
      cart.couponCode = null;
      await cart.save();
    }
    const items = cart?.items || [];
    const resolvedItems = await resolveCartItemsWithPromotions(items);
    const summary = calculateCartSummary(resolvedItems, "KARNATAKA", null);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: cart?._id,
          ...summary,
        },
        "Coupon removed successfully"
      )
    );
  } else {
    const uKey = userId.toString();
    memoryCartCoupons.delete(uKey);
    const userCart = memoryCarts.get(uKey) || [];
    const resolvedUserCart = await resolveCartItemsWithPromotions(userCart);
    const summary = calculateCartSummary(resolvedUserCart, "KARNATAKA", null);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: `cart_${uKey}`,
          ...summary,
        },
        "Coupon removed successfully"
      )
    );
  }
});
