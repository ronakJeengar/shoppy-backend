import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
} from "../controllers/product.controller.js";
import { verifyJWT, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/", verifyJWT, requireRole(["ADMIN"]), createProduct);

export default router;
