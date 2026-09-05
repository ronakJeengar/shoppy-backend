import { Router } from "express";
import {
  getProducts,
  getProductSuggestions,
  getProductById,
  createProduct,
} from "../controllers/product.controller.js";
import { verifyJWT, requireRole, optionalJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", optionalJWT, getProducts);
router.get("/suggestions", getProductSuggestions);
router.get("/:id", optionalJWT, getProductById);
router.post("/", verifyJWT, requireRole(["ADMIN"]), createProduct);

export default router;
