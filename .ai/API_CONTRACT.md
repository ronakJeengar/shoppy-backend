# Shoppy Authoritative API Contract

Base URL: `http://localhost:8000/api/v1`

## 1. Authentication & Users
- `POST /auth/register` - Create new customer or admin account.
- `POST /auth/login` - Authenticate with email/password; returns JWT accessToken and user object.
- `GET /auth/me` - Fetch profile of currently authenticated user.
- `PATCH /auth/profile` - Update profile attributes (fullName, phone).
- `POST /auth/change-password` - Authoritative password update verifying current password.

## 2. Product Catalog & Categories
- `GET /categories` - List active categories with slug and image.
- `GET /products` - List products with pagination (`page`, `limit`), sorting (`price_asc`, `price_desc`, `rating`, `newest`), category filtering (`categoryId`), price boundaries (`minPrice`, `maxPrice`), search keywords (`q`), and in-stock filter (`inStock`).
- `GET /products/suggestions?q=:query` - Autocomplete suggestions for search input.
- `GET /products/:id` - Fetch detailed product attributes, gallery, and ratings.

## 3. Cart & Wishlist Management
- `GET /cart` - Fetch user's cart with authoritative product details and subtotal.
- `POST /cart/items` - Add item to cart with quantity validation against live stock.
- `PATCH /cart/items/:id` - Update quantity of item in cart.
- `DELETE /cart/items/:id` - Remove item from cart.
- `GET /wishlist` - Fetch user's saved wishlist items.
- `POST /wishlist/toggle` - Atomically add/remove product to/from user wishlist.

## 4. Checkout & Orders
- `GET /addresses` - List user saved delivery addresses (with `pinCode`, `district`, `landmark`, `state`, `country: "IN"`).
- `POST /addresses` - Add new delivery address.
- `POST /checkout/validate` - Authoritatively validate shipping (Standard: Free over ₹499 else ₹49; Express: ₹99), subtotal, Indian GST breakdown (`taxBreakdown` containing `cgst`, `sgst`, `igst`, `rates`, `taxableAmount`, `totalTax`, `isInterState` evaluated against store origin state `KARNATAKA`), and `grandTotal`.
- `POST /checkout/create` - Create order and initiate payment with idempotency key, capturing snapshot of `taxBreakdown`, `customerGstin`, and HSN codes.
- `POST /payments/verify` - Confirm payment signature and transition order to CONFIRMED.
- `GET /orders` - List user orders sorted by newest first.
- `GET /orders/:id` - Detailed order breakdown with status history, items snapshot, GST breakdown, and tracking.
- `POST /orders/:id/cancel` - Cancel confirmed order (IDOR protected, stock restored).

## 5. Reviews & Ratings
- `GET /products/:productId/reviews` - List approved customer reviews with star rating breakdown.
- `GET /products/:productId/reviews/eligibility` - Check if user has purchased item and can write review.
- `POST /products/:productId/reviews` - Submit review with verified purchase enforcement.

## 6. Recommendations & AI Interaction
- `GET /recommendations?type=PERSONALIZED|TRENDING|SIMILAR_PRODUCTS|FREQUENTLY_BOUGHT_TOGETHER` - Non-authoritative recommendations powered by vector/collaborative signals.
- `POST /recommendations/events` - Track user interactions (VIEW_PRODUCT, ADD_TO_CART, WISHLIST_ADD).
- `POST /ai/assistant/chat` - Natural language shopping assistant returning structured response with intent, products, and non-authoritative recommendations.

## 7. Coupons & Promotions (Feature 2)
- `GET /coupons/available` - List all active, non-expired coupons available for promotion and discovery.
- `POST /coupons/validate` - Validate coupon against cart or items; returns authoritative discount amount, new subtotal, and validity constraints.
- `POST /cart/coupon` - Apply coupon code to user's cart; authoritatively computes discount, updates cart totals and GST, and returns cart snapshot.
- `DELETE /cart/coupon` - Remove applied coupon from user's cart and recalculate standard totals.

## 8. Admin Coupon Management
- `GET /admin/coupons` - List coupons with pagination and status filters (`active`, `inactive`, `expired`). Requires ADMIN role.
- `POST /admin/coupons` - Create a new coupon rule (`code`, `discountType`, `discountValue`, `minimumOrderValue`, `maximumDiscountAmount`, `startAt`, `expiresAt`, `usageLimit`, `perUserLimit`, `firstOrderOnly`).
- `GET /admin/coupons/:id` - Fetch coupon details and usage statistics.
- `PATCH /admin/coupons/:id` - Update coupon parameters.
- `PATCH /admin/coupons/:id/status` - Toggle active/inactive status.
- `DELETE /admin/coupons/:id` - Soft or hard delete coupon.

## 9. Campaigns & Sale Banners (Feature 3)
- `GET /campaigns/active` - List currently active promotional campaigns and sale banners evaluated authoritatively on the backend (`startAt <= now <= endAt`, `isActive: true`, deterministic order `priority: -1, displayOrder: 1`). Supports `limit` and `type` filters.
- `GET /campaigns/:id` - Fetch single campaign metadata.

## 10. Admin Campaign Management
- `GET /admin/campaigns` - Paginated campaign listing filterable by status (`all`, `active`, `inactive`, `expired`, `scheduled`) and `type`. Requires ADMIN role.
- `POST /admin/campaigns` - Create a new sale campaign with date validation (`endAt > startAt`) and allowlisted CTA action.
- `GET /admin/campaigns/:id` - Fetch detailed campaign metadata.
- `PATCH /admin/campaigns/:id` - Update campaign parameters with schema validation.
- `PATCH /admin/campaigns/:id/status` - Toggle active/inactive status.
- `DELETE /admin/campaigns/:id` - Delete campaign.
