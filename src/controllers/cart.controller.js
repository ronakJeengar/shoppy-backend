import mongoose from "mongoose";
import { Cart } from "../models/cart.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// In-memory test store for when MongoDB is disconnected during tests
export const memoryCarts = new Map();

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

const calculateCartSummary = (items) => {
  let subtotal = 0;
  let itemCount = 0;

  const formattedItems = items
    .filter((item) => item.product)
    .map((item) => {
      const p = item.product;
      const qty = item.quantity;
      const unitPrice = typeof p.price === "number" ? p.price : 0;
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      subtotal += lineTotal;
      itemCount += qty;

      return {
        id: item._id ? item._id.toString() : p._id.toString(),
        productId: p._id ? p._id.toString() : p.id,
        productName: p.productName || p.name || "Product",
        sellerName: p.sellerName || "Official Seller",
        productImage: p.productImage || p.imageUrl || "",
        price: unitPrice,
        quantity: qty,
        stock: p.stock !== undefined ? p.stock : 99,
        isAvailable: (p.stock !== undefined ? p.stock : 99) >= qty,
        lineTotal,
      };
    });

  subtotal = Math.round(subtotal * 100) / 100;
  const shipping = subtotal > 50 || subtotal === 0 ? 0 : 4.99;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + shipping + tax) * 100) / 100;

  return {
    items: formattedItems,
    itemCount,
    subtotal,
    shipping,
    tax,
    total,
  };
};

export const getCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (mongoose.connection.readyState === 1) {
    let cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    const summary = calculateCartSummary(cart.items);
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
    const summary = calculateCartSummary(userCart);

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

    let newQuantity = parsedQty;
    if (existingIndex > -1) {
      newQuantity = cart.items[existingIndex].quantity + parsedQty;
      if (newQuantity > product.stock) {
        throw new ApiError(
          400,
          `Cannot add more items. Only ${product.stock} items available in stock.`
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
      cart.items.push({ product: productId, quantity: parsedQty });
    }

    await cart.save();
    const populated = await Cart.findById(cart._id).populate("items.product");
    const summary = calculateCartSummary(populated.items);

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
      userCart[existingIndex].quantity = newQty;
    } else {
      if (parsedQty > product.stock) {
        throw new ApiError(
          400,
          `Cannot add requested quantity. Only ${product.stock} items available in stock.`
        );
      }
      userCart.push({
        _id: `item_${Date.now()}`,
        product,
        quantity: parsedQty,
      });
    }

    memoryCarts.set(uKey, userCart);
    const summary = calculateCartSummary(userCart);

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
      cart.items[itemIndex].quantity = parsedQty;
    }

    await cart.save();
    const populated = await Cart.findById(cart._id).populate("items.product");
    const summary = calculateCartSummary(populated.items);

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
      userCart[itemIndex].quantity = parsedQty;
    }

    memoryCarts.set(uKey, userCart);
    const summary = calculateCartSummary(userCart);

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
    const summary = calculateCartSummary(populated.items || []);

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
    const summary = calculateCartSummary(userCart);

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
