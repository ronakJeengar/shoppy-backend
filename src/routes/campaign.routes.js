import { Router } from "express";
import {
  getActiveCampaigns,
  getCampaignById,
} from "../controllers/campaign.controller.js";

const router = Router();

// Public customer routes for discovering active campaigns
router.get("/active", getActiveCampaigns);
router.get("/:id", getCampaignById);

export default router;
