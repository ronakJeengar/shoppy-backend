import { Router } from "express";
import {
  getWishlist,
  toggleWishlistItem,
  addToWishlist,
  removeFromWishlist,
} from "../controllers/wishlist.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/", getWishlist);
router.post("/toggle", toggleWishlistItem);
router.post("/", addToWishlist);
router.delete("/:productId", removeFromWishlist);

export default router;
