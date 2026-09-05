import { Router } from "express";
import {
  getRecommendations,
  trackEvent,
} from "../controllers/recommendation.controller.js";
import { optionalJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Retrieve recommendations (personalized, similar, frequently_bought_together, trending, recently_viewed)
router.get("/", optionalJWT, getRecommendations);

// Track behavioral interaction event (views, clicks, cart/wishlist mutations)
router.post("/events", optionalJWT, trackEvent);

export default router;
