import { Router } from "express";
import { getAppBootstrap } from "../controllers/app_config.controller.js";

const router = Router();

// Public App Bootstrap & Remote Configuration endpoint
router.get("/bootstrap", getAppBootstrap);

export default router;
