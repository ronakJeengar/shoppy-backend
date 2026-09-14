import { Router } from "express";
import {
  getEmiPlans,
  calculateEmiQuote,
} from "../controllers/emi.controller.js";

const router = Router();

// Public: Get available EMI plans (optionally filtered and quoted by ?amount=XXXX)
router.get("/plans", getEmiPlans);

// Public: Compute standalone reducing balance or no-cost EMI quote
router.post("/calculate", calculateEmiQuote);

export default router;
