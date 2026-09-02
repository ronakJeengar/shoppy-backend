import { Router } from "express";
import {
  getCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
} from "../controllers/cart.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/", getCart);
router.post("/items", addItemToCart);
router.patch("/items/:productId", updateCartItemQuantity);
router.delete("/items/:productId", removeCartItem);
router.delete("/", clearCart);

export default router;
