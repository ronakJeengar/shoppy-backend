import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getProductReviews,
  getReviewEligibility,
  createProductReview,
  updateReview,
  deleteReview,
} from "../controllers/review.controller.js";

const router = Router();

// Public: view reviews and rating breakdown for a product
router.get("/products/:productId/reviews", getProductReviews);

// Authenticated: check eligibility to review a product
router.get(
  "/products/:productId/reviews/eligibility",
  verifyJWT,
  getReviewEligibility
);

// Authenticated: submit review for a product
router.post("/products/:productId/reviews", verifyJWT, createProductReview);

// Authenticated: edit own review
router.patch("/reviews/:id", verifyJWT, updateReview);

// Authenticated: delete own review (or admin)
router.delete("/reviews/:id", verifyJWT, deleteReview);

export default router;
