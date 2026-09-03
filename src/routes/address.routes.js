import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/address.controller.js";

const router = Router();

// All address routes require authenticated user
router.use(verifyJWT);

router.route("/").get(getAddresses).post(createAddress);
router.route("/:id").get(getAddressById).patch(updateAddress).delete(deleteAddress);

export default router;
