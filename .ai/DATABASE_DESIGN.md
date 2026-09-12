# Shoppy Database Design & Seed Architecture

## 1. Overview
Shoppy uses MongoDB 7.0 (local Docker container `shoppy-mongodb` on port `27017`) as the authoritative persistence store. All data operations (products, orders, carts, wishlists, reviews, user authentication, inventory) are executed against this database.

## 2. Collections & Schema Definitions

### Users (`users`)
- `_id`: ObjectId
- `fullName`: String (Indexed)
- `email`: String (Unique, Lowercase, Indexed)
- `password`: String (Bcrypt hash, salt rounds: 10)
- `role`: Enum `['CUSTOMER', 'ADMIN', 'SELLER']` (Default: `'CUSTOMER'`)
- `phone`: String (Optional)
- `notificationPreferences`: Object `{ email: Boolean, push: Boolean, sms: Boolean }`
- `createdAt`, `updatedAt`: Timestamps

### Categories (`categories`)
- `_id`: ObjectId
- `name`: String (Unique, Trimmed)
- `slug`: String (Unique, Lowercase, Indexed)
- `description`: String
- `icon`: String (Material icon identifier)
- `imageUrl`: String (High-res Unsplash CDN)
- `isActive`: Boolean (Default: `true`)

### Products (`products`)
- `_id`: ObjectId
- `productName`: String (Text Indexed, Trimmed)
- `sellerName`: String (Brand/Merchant)
- `description`: String (Markdown/Plain text)
- `price`: Number (Authoritative base price in INR ₹, min: 0)
- `mrp`: Number (Maximum Retail Price for comparison)
- `discountPercentage`: Number (Computed/Explicit)
- `hsnCode`: String (Harmonized System of Nomenclature, e.g. "8518", "6109", "8471")
- `gstRate`: Number (Enum: `[0, 5, 12, 18, 28]`, Default: `18`)
- `isTaxInclusive`: Boolean (Default: `true`)
- `isCodEligible`: Boolean (Default: `true`)
- `stock`: Number (Authoritative inventory count, min: 0)
- `productRating`: Number (Aggregated average, min: 0, max: 5)
- `totalReviews`: Number (Count of verified customer reviews)
- `productImage`: String (Primary image URL)
- `gallery`: Array of Strings (High-res product images)
- `category`: ObjectId (Ref to `categories`, Indexed)
- `categoryName`: String (Denormalized category display name)
- `tags`: Array of Strings (Indexed for search & discovery)
- `isFeatured`: Boolean (Default: `false`)
- `status`: Enum `['ACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED']` (Default: `'ACTIVE'`)
- `createdAt`, `updatedAt`: Timestamps

### Orders (`orders`)
- `_id`: ObjectId
- `orderNumber`: String (Unique, Format: `ORD-YYYY-XXXXX`)
- `user`: ObjectId (Ref to `users`, Indexed)
- `currency`: String (Default: `'INR'`)
- `orderItems`: Array of Subdocuments:
  - `product`: ObjectId (Ref to `products`)
  - `productName`: String (Snapshot)
  - `productImage`: String (Snapshot)
  - `sellerName`: String (Snapshot)
  - `unitPrice`: Number (Authoritative snapshot price in INR at checkout)
  - `quantity`: Number (Min: 1)
  - `lineTotal`: Number (unitPrice * quantity)
  - `hsnCode`: String (Snapshot)
  - `gstRate`: Number (Snapshot: 0, 5, 12, 18, 28)
  - `isTaxInclusive`: Boolean (Snapshot)
  - `taxableAmount`: Number (Snapshot)
  - `discount`: Number
- `shippingAddress`: Object (Immutable snapshot):
  - `fullName`, `phone`, `streetAddress`, `landmark`, `city`, `district`, `state`, `postalCode` / `pinCode`, `country`
- `customerGstin`: String (Optional Indian GSTIN)
- `taxBreakdown`: Object (Authoritative GST breakdown):
  - `cgst`: Number (Central GST for intra-state)
  - `sgst`: Number (State GST for intra-state)
  - `igst`: Number (Integrated GST for inter-state)
  - `totalTax`: Number (cgst + sgst + igst)
  - `taxableAmount`: Number (Total taxable value)
  - `isInterState`: Boolean (true if delivery state != origin state KARNATAKA)
  - `rates`: Array of `{ rate, taxableAmount, cgst, sgst, igst }`
- `pricing`: Object:
  - `subtotal`: Number
  - `shippingFee`: Number (Free over ₹499 else ₹49; Express: ₹99)
  - `tax`: Number (Authoritatively calculated GST)
  - `discount`: Number
  - `totalAmount`: Number (subtotal + shippingFee + (tax if exclusive) - discount)
- `coupon`: Object (Snapshot of applied promotion, optional):
  - `code`: String (Authoritative coupon code)
  - `discount`: Number (Snapshot discount amount in INR)
  - `discountType`: Enum `['PERCENTAGE', 'FIXED']`
  - `discountValue`: Number
  - `appliedAt`: Date
- `paymentMethod`: Enum `['CARD', 'COD', 'UPI']`
- `paymentStatus`: Enum `['PENDING', 'PAID', 'FAILED', 'REFUNDED']`
- `status`: Enum `['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']`
- `tracking`: Object:
  - `carrier`: String
  - `trackingNumber`: String
  - `estimatedDelivery`: Date
  - `events`: Array of `{ status, timestamp, note }`
- `createdAt`, `updatedAt`: Timestamps

### Coupons (`coupons`)
- `_id`: ObjectId
- `code`: String (Unique, Uppercase, Trimmed, Indexed)
- `title`: String
- `description`: String
- `discountType`: Enum `['PERCENTAGE', 'FIXED']`
- `discountValue`: Number (min: 0)
- `minimumOrderValue`: Number (min: 0, default: 0)
- `maximumDiscountAmount`: Number (nullable/optional)
- `startAt`: Date (default: Date.now)
- `expiresAt`: Date (Indexed)
- `isActive`: Boolean (default: true, Indexed)
- `usageLimit`: Number (total platform limit, nullable/optional)
- `usedCount`: Number (default: 0)
- `perUserLimit`: Number (default: 1)
- `firstOrderOnly`: Boolean (default: false)
- `userUsage`: Array of Subdocuments:
  - `userId`: ObjectId (Ref to `users`, Indexed)
  - `usedCount`: Number (default: 0)
  - `lastUsedAt`: Date
- `createdAt`, `updatedAt`: Timestamps

### Reviews (`reviews`)
- `_id`: ObjectId
- `product`: ObjectId (Ref to `products`, Compound Indexed with `user`)
- `user`: ObjectId (Ref to `users`)
- `authorName`: String
- `rating`: Number (Integer 1-5)
- `title`: String
- `comment`: String
- `verifiedPurchase`: Boolean (Enforced: user must have confirmed/delivered order)
- `status`: Enum `['APPROVED', 'PENDING', 'REJECTED']` (Default: `'APPROVED'`)
- `createdAt`: Timestamp

### Addresses (`addresses`)
- `_id`: ObjectId
- `user`: ObjectId (Ref to `users`, Indexed)
- `fullName`: String
- `phone`: String
- `streetAddress`: String
- `landmark`: String
- `city`: String
- `district`: String
- `state`: String (Used for intra-state vs inter-state GST calculations)
- `pinCode` / `postalCode`: String (6-digit Indian PIN code)
- `country`: String (Default: `'IN'`)
- `isDefault`: Boolean (Default: `false`)

### Cart & Wishlist (`carts`, `wishlists`)
- Per-user single documents storing items with product reference, quantity, and added timestamp.
- Cart stores optional `couponCode` (String) referencing applied promotion. Summary calculation dynamically computes `discount`, `taxableAmount`, and `appliedCoupon` object snapshot without persisting ephemeral financial calculations.

## 3. Seeding Specification (`unified.seed.js`)
Executed via `npm run seed`:
- **Categories (6)**: Electronics, Fashion & Apparel, Home & Kitchen, Audio & Acoustics, Computing & Tech, Accessories.
- **Products (38)**: Comprehensive high-resolution catalog across all 6 categories, configured with realistic Indian INR pricing, MRPs, HSN codes (e.g. 8518, 6109, 8471), and GST tax rates across 0%, 5%, 12%, 18%, and 28% slabs.
- **Users (3)**:
  - Customer: `customer@shoppy.com` / `Customer@12345` (ID: predefined for tests/demo)
  - Administrator: `admin@shoppy.com` / `Admin@12345`
  - Demo User: `demo@shoppy.com` / `Demo@12345`
- **Coupons (7)**:
  - `WELCOME10`: 10% off (Max ₹500, Min ₹999, First Order Only)
  - `FLAT500`: ₹500 flat off (Min ₹2,999)
  - `FESTIVE20`: 20% festive discount (Max ₹1,500, Min ₹1,999)
  - `FREESHIP`: ₹49 flat shipping discount (Min ₹299)
  - `SUMMER15`: 15% summer discount (Max ₹750, Min ₹1,499)
  - `EXPIRED10`: Past expiry date test coupon
  - `INACTIVE50`: Inactive test coupon
- **Orders (2)**: 1 DELIVERED order with item snapshots, GST breakdown, & tracking; 1 CONFIRMED order.
- **Reviews (2)**: Verified customer reviews with 5-star ratings.
- **Notifications (3)**: Welcome, Order Shipped, and Seasonal Discount notifications.
