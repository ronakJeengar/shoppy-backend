export const DEFAULT_SHOPPY_KNOWLEDGE = [
  {
    title: "Shoppy Return & Refund Policy",
    sourceType: "RETURNS",
    visibility: "PUBLIC",
    status: "ACTIVE",
    version: 1,
    content: `## Return Eligibility Window
Shoppy provides a comprehensive 30-day return policy for most items purchased through our platform. Customers have 30 calendar days from the date of physical delivery to initiate a return request.

## Item Condition Requirements
To be eligible for a full refund, returned items must be in their original, unused, unwashed condition, with all manufacturer packaging, barcodes, tags, and accessories intact. Products returned damaged, worn, or missing original components may be rejected or subject to a restocking fee.

## Refund Process & Timeline
Once a returned item is received and inspected at our fulfillment center (typically within 48 hours of receipt), the refund is processed immediately. Funds are credited back to the customer's original payment method within 5 to 7 business days, depending on bank processing times.

## Free Return Shipping
Shoppy offers free return shipping on all domestic orders within the 30-day window. Prepaid return shipping labels can be generated directly from the order history page.`,
    metadata: {
      topic: "returns",
      keywords: ["returns", "refund", "30 days", "eligibility", "condition"],
    },
  },
  {
    title: "Shoppy Shipping & Delivery Guidelines",
    sourceType: "SHIPPING",
    visibility: "PUBLIC",
    status: "ACTIVE",
    version: 1,
    content: `## Standard Domestic Delivery
Standard shipping delivers within 3 to 5 business days across all domestic postal codes. Orders placed before 5:00 PM on weekdays are dispatched the same day.

## Express Delivery Options
Express delivery guarantees arrival in 1 to 2 business days for orders placed prior to 2:00 PM. Express shipping is supported across major metropolitan delivery routes.

## Free Shipping Threshold
Shoppy provides 100% free standard shipping on all orders with a subtotal of $50.00 or higher before taxes. Orders below $50.00 incur a flat shipping charge of $4.99.

## Order Tracking
Real-time tracking links and package status updates are provided via email and in-app notifications immediately upon package dispatch from our fulfillment centers.`,
    metadata: {
      topic: "shipping",
      keywords: ["shipping", "delivery", "free shipping", "standard", "express"],
    },
  },
  {
    title: "Shoppy Order Cancellation Policy",
    sourceType: "POLICY",
    visibility: "PUBLIC",
    status: "ACTIVE",
    version: 1,
    content: `## Eligible Cancellation Window
Customers may cancel an order free of charge at any time while the order remains in PENDING_PAYMENT or CONFIRMED status. 

## Ineligible Post-Shipment Cancellations
Once an order transitions to SHIPPED or DELIVERED status, it has already departed our warehouse and cannot be cancelled. In such cases, customers should wait for delivery and initiate a standard 30-day return.

## Inventory & Payment Rollback
When an eligible order is cancelled, reserved stock quantities are atomically restored to available inventory, and any pre-authorized payments are refunded immediately to the original payment source.`,
    metadata: {
      topic: "cancellation",
      keywords: ["cancel", "cancellation", "order status", "refund"],
    },
  },
  {
    title: "Shoppy Product Warranty Coverage",
    sourceType: "HELP",
    visibility: "PUBLIC",
    status: "ACTIVE",
    version: 1,
    content: `## Consumer Electronics Warranty
All consumer electronics (smartphones, audio gear, laptops) purchased on Shoppy carry a 1-year comprehensive manufacturer warranty covering hardware defects and manufacturing flaws.

## Accessories Coverage
Mobile accessories, cables, adapters, and audio cases carry a 6-month limited warranty.

## Filing a Warranty Claim
To file a warranty claim, visit the product details page in your order history and click 'File Warranty Claim', or contact official brand service centers using the digital purchase invoice available in your Shoppy account.`,
    metadata: {
      topic: "warranty",
      keywords: ["warranty", "electronics", "guarantee", "repair"],
    },
  },
  {
    title: "Shoppy Payment Methods & Security",
    sourceType: "PAYMENTS",
    visibility: "PUBLIC",
    status: "ACTIVE",
    version: 1,
    content: `## Supported Payment Methods
Shoppy accepts all major Credit and Debit Cards (Visa, Mastercard, American Express, RuPay), UPI, Net Banking, and Cash on Delivery (COD) on eligible domestic orders.

## Bank-Grade Security Standards
All payment transactions are encrypted using 256-bit TLS encryption and processed through PCI-DSS Level 1 certified payment gateways. Shoppy never stores raw card numbers or CVV codes on its servers.

## Webhook & Idempotency Protection
Every checkout operation requires a cryptographic Idempotency-Key header to prevent duplicate debit charges, and payment gateway webhooks are authenticated via HMAC SHA-256 signatures.`,
    metadata: {
      topic: "payments",
      keywords: ["payment", "credit card", "upi", "security", "cod"],
    },
  },
  {
    title: "Shoppy Customer Reviews & Ratings Policy",
    sourceType: "FAQ",
    visibility: "PUBLIC",
    status: "ACTIVE",
    version: 1,
    content: `## Verified Purchase Requirement
Only customers who have purchased the specific product and received delivery (DELIVERED status) are permitted to submit product reviews and ratings. This prevents fake or bot reviews.

## One Review Per Product Rule
Each customer is permitted exactly one review per product. Customers may edit or delete their existing review at any time from the product page.

## Star Rating Scale
Ratings must be whole numbers from 1 to 5 stars, accompanied by helpful descriptive feedback between 3 and 1000 characters in length.`,
    metadata: {
      topic: "reviews",
      keywords: ["reviews", "ratings", "verified purchase", "feedback"],
    },
  },
  {
    title: "Shoppy Admin Return Inspection SOP",
    sourceType: "POLICY",
    visibility: "ADMIN",
    status: "ACTIVE",
    version: 1,
    content: `## Admin Internal Inspection Standards
Fulfillment specialists must verify returned packages against original invoice items within 24 hours of warehouse arrival. 

## Defect Escalation Guidelines
If a returned product exhibits customer-induced physical damage, notify warehouse supervisor and record photographic evidence before denying refund transition in the admin portal.`,
    metadata: {
      topic: "admin_sop",
      keywords: ["admin", "inspection", "warehouse", "sop"],
    },
  },
];
