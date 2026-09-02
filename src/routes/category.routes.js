import { Router } from "express";
import {
  getCategories,
  createCategory,
} from "../controllers/category.controller.js";
import { verifyJWT, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", getCategories);
router.post("/", verifyJWT, requireRole(["ADMIN"]), createCategory);

export default router;
