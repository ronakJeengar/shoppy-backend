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
- `price`: Number (Authoritative base price, min: 0)
- `originalPrice`: Number (MSRP/Comparison price)
- `discountPercentage`: Number (Computed/Explicit)
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
- `orderItems`: Array of Subdocuments:
  - `product`: ObjectId (Ref to `products`)
  - `productName`: String (Snapshot)
  - `productImage`: String (Snapshot)
  - `sellerName`: String (Snapshot)
  - `unitPrice`: Number (Authoritative snapshot price at checkout)
  - `quantity`: Number (Min: 1)
  - `lineTotal`: Number (unitPrice * quantity)
- `shippingAddress`: Object (Immutable snapshot):
  - `fullName`, `phone`, `streetAddress`, `city`, `state`, `postalCode`, `country`
- `pricing`: Object:
  - `subtotal`: Number
  - `shippingFee`: Number
  - `tax`: Number (Authoritatively calculated: 8%)
  - `discount`: Number
  - `totalAmount`: Number (subtotal + shippingFee + tax - discount)
- `paymentMethod`: Enum `['CARD', 'COD', 'UPI']`
- `paymentStatus`: Enum `['PENDING', 'PAID', 'FAILED', 'REFUNDED']`
- `status`: Enum `['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']`
- `tracking`: Object:
  - `carrier`: String
  - `trackingNumber`: String
  - `estimatedDelivery`: Date
  - `events`: Array of `{ status, timestamp, note }`
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
- `city`: String
- `state`: String
- `postalCode`: String
- `country`: String (Default: `'United States'`)
- `isDefault`: Boolean (Default: `false`)

### Cart & Wishlist (`carts`, `wishlists`)
- Per-user single documents storing items with product reference, quantity, and added timestamp.

## 3. Seeding Specification (`unified.seed.js`)
Executed via `npm run seed`:
- **Categories (6)**: Electronics, Fashion & Apparel, Home & Kitchen, Audio & Acoustics, Computing & Tech, Accessories.
- **Products (18)**: Realistic high-resolution catalog across all 6 categories, complete with tags, stock levels, ratings, reviews count, and galleries.
- **Users (3)**:
  - Customer: `customer@shoppy.com` / `Customer@12345` (ID: predefined for tests/demo)
  - Administrator: `admin@shoppy.com` / `Admin@12345`
  - Demo User: `demo@shoppy.com` / `Demo@12345`
- **Orders (2)**: 1 DELIVERED order with item snapshots & tracking, 1 CONFIRMED order.
- **Reviews (2)**: Verified customer reviews with 5-star ratings.
- **Notifications (3)**: Welcome, Order Shipped, and Seasonal Discount notifications.
