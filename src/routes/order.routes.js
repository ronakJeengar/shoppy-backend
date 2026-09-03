import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getOrderById,
  getUserOrders,
} from "../controllers/order.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/").get(getUserOrders);
router.route("/:id").get(getOrderById);

export default router;
