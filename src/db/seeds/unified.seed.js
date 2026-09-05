import mongoose from "mongoose";
import dotenv from "dotenv";
import { DB_NAME } from "../../constants.js";
import { Category } from "../../models/category.model.js";
import { Product } from "../../models/product.model.js";
import { User } from "../../models/user.model.js";
import { Address } from "../../models/address.model.js";
import { Order } from "../../models/order.model.js";
import { Review } from "../../models/review.model.js";
import { Notification } from "../../models/notification.model.js";
import { Cart } from "../../models/cart.model.js";
import { Wishlist } from "../../models/wishlist.model.js";

dotenv.config();

export const seedDatabase = async () => {
  console.log("🌱 Starting unified database seeding...");

  // 1. Clear existing data
  await Promise.all([
    Category.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({}),
    Address.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
    Notification.deleteMany({}),
    Cart.deleteMany({}),
    Wishlist.deleteMany({}),
  ]);

  console.log("🧹 Cleared all collections.");

  // 2. Seed Categories
  const categoryDocs = await Category.create([
    { name: "electronics" },
    { name: "fashion" },
    { name: "home & living" },
    { name: "sports & outdoors" },
    { name: "books & stationery" },
    { name: "beauty & wellness" },
  ]);

  const catMap = {};
  for (const c of categoryDocs) {
    catMap[c.name] = c._id;
  }
  console.log(`📦 Seeded ${categoryDocs.length} categories.`);

  // 3. Seed Products
  const productsData = [
    // Electronics
    {
      productName: "Aura Pro Wireless Noise-Cancelling Headphones",
      sellerName: "Aura Audio Labs",
      description:
        "Premium over-ear studio headphones with hybrid active noise cancellation, custom 40mm titanium drivers, 35-hour battery life, and ultra-plush memory foam cushions.",
      price: 249.99,
      stock: 55,
      productRating: 4.9,
      totalReviews: 128,
      productImage:
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
      category: catMap["electronics"],
      isActive: true,
    },
    {
      productName: "Titan Chronos Ultra Smartwatch",
      sellerName: "Titan Wearables",
      description:
        "Sapphire crystal display smartwatch featuring dual-frequency GPS, ECG monitor, continuous body temperature tracking, 100m water resistance, and 7-day battery endurance.",
      price: 299.0,
      stock: 42,
      productRating: 4.8,
      totalReviews: 94,
      productImage:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
      category: catMap["electronics"],
      isActive: true,
    },
    {
      productName: "Lumix Portable Bluetooth 360 Speaker",
      sellerName: "Lumix Sound",
      description:
        "IP67 dustproof and waterproof cylindrical speaker delivering 360-degree immersive acoustic sound, punchy bass radiators, and built-in power bank functionality.",
      price: 89.95,
      stock: 80,
      productRating: 4.7,
      totalReviews: 76,
      productImage:
        "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=80",
      category: catMap["electronics"],
      isActive: true,
    },
    {
      productName: "PixelStream 4K Ultra-HD Webcam",
      sellerName: "VisionTech Pro",
      description:
        "Broadcast-grade 4K streaming webcam equipped with dual AI noise-canceling microphones, auto-framing focus, privacy shutter, and high dynamic range (HDR) sensor.",
      price: 119.5,
      stock: 35,
      productRating: 4.6,
      totalReviews: 45,
      productImage:
        "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80",
      category: catMap["electronics"],
      isActive: true,
    },

    // Fashion
    {
      productName: "Heritage Full-Grain Leather Weekender Bag",
      sellerName: "Artisan & Hide",
      description:
        "Handcrafted vegetable-tanned Italian leather duffel featuring solid brass hardware, reinforced luggage handles, a dedicated shoe compartment, and waterproof lining.",
      price: 185.0,
      stock: 24,
      productRating: 4.9,
      totalReviews: 52,
      productImage:
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80",
      category: catMap["fashion"],
      isActive: true,
    },
    {
      productName: "Organic Pima Cotton Relaxed Crewneck",
      sellerName: "Nordic Loom",
      description:
        "Sustainably harvested 100% organic Peruvian Pima cotton tee with a buttery-soft hand feel, reinforced collar, and tailored drape.",
      price: 38.0,
      stock: 150,
      productRating: 4.7,
      totalReviews: 112,
      productImage:
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
      category: catMap["fashion"],
      isActive: true,
    },
    {
      productName: "Minimalist RFID Carbon Fiber Slim Wallet",
      sellerName: "Vanguard Gear",
      description:
        "Ultra-lightweight aerospace matte carbon fiber cardholder with integrated cash clip, thumb notch for rapid card access, and military-grade RFID protection.",
      price: 45.0,
      stock: 90,
      productRating: 4.8,
      totalReviews: 88,
      productImage:
        "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80",
      category: catMap["fashion"],
      isActive: true,
    },
    {
      productName: "Polarized Aviator Classic Sunglasses",
      sellerName: "Solstice Eyewear",
      description:
        "Lightweight titanium frame aviators with scratch-resistant polarized UV400 lenses, adjustable silicone nose pads, and microfibre protective pouch.",
      price: 79.0,
      stock: 60,
      productRating: 4.6,
      totalReviews: 63,
      productImage:
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80",
      category: catMap["fashion"],
      isActive: true,
    },

    // Home & Living
    {
      productName: "Artisan Ceramic Pour-Over Coffee Station",
      sellerName: "Kōhī Craft",
      description:
        "Minimalist matte stoneware coffee dripper with spiral extraction channels, ergonomic heat-resistant carafe, and reusable double-layer stainless mesh filter.",
      price: 49.99,
      stock: 40,
      productRating: 4.9,
      totalReviews: 67,
      productImage:
        "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop&q=80",
      category: catMap["home & living"],
      isActive: true,
    },
    {
      productName: "Nordic Minimalist Stoneware Dinnerware Set",
      sellerName: "Hygge Living",
      description:
        "16-piece handcrafted stoneware dining collection with subtle speckled glaze. Microwave, oven, and dishwasher safe.",
      price: 135.0,
      stock: 30,
      productRating: 4.8,
      totalReviews: 41,
      productImage:
        "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&auto=format&fit=crop&q=80",
      category: catMap["home & living"],
      isActive: true,
    },
    {
      productName: "Ultrasonic Essential Oil Aromatherapy Diffuser",
      sellerName: "Zenith Home",
      description:
        "BPA-free real bamboo casing diffuser with whisper-quiet ultrasonic atomization, warm ambient LED glow, and automatic waterless shut-off.",
      price: 36.99,
      stock: 75,
      productRating: 4.7,
      totalReviews: 92,
      productImage:
        "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&auto=format&fit=crop&q=80",
      category: catMap["home & living"],
      isActive: true,
    },

    // Sports & Outdoors
    {
      productName: "Thermal Insulated Stainless Water Bottle 1L",
      sellerName: "Summit Outdoors",
      description:
        "Double-walled vacuum insulated flask keeping ice cold for 28 hours or piping hot for 14 hours. Textured powder-coat grip and leak-proof spout lid.",
      price: 29.99,
      stock: 110,
      productRating: 4.9,
      totalReviews: 180,
      productImage:
        "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80",
      category: catMap["sports & outdoors"],
      isActive: true,
    },
    {
      productName: "High-Density Eco Yoga & Fitness Mat 6mm",
      sellerName: "Prana Essentials",
      description:
        "Non-slip alignment patterned eco-TPE exercise mat with anti-tear mesh core, joint-cushioning density, and lightweight carrying sling included.",
      price: 42.5,
      stock: 65,
      productRating: 4.8,
      totalReviews: 54,
      productImage:
        "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=800&auto=format&fit=crop&q=80",
      category: catMap["sports & outdoors"],
      isActive: true,
    },
    {
      productName: "Pro Speed Carbon Bearing Jump Rope",
      sellerName: "Summit Outdoors",
      description:
        "Aircraft-grade aluminum knurled handles with 360-degree dual ball bearings and kink-free polymer-coated steel cable for maximum rotation speed.",
      price: 19.99,
      stock: 95,
      productRating: 4.6,
      totalReviews: 38,
      productImage:
        "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
      category: catMap["sports & outdoors"],
      isActive: true,
    },

    // Books & Stationery
    {
      productName: "Archival Hardcover Dotted Journal Notebook",
      sellerName: "PaperCraft Studio",
      description:
        "160 numbered pages of bleed-proof 120gsm ivory paper, expanding rear document pocket, dual satin ribbons, and lay-flat Smyth-sewn binding.",
      price: 21.0,
      stock: 85,
      productRating: 4.9,
      totalReviews: 89,
      productImage:
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80",
      category: catMap["books & stationery"],
      isActive: true,
    },
    {
      productName: "Brass Mechanical Rollerball Drafting Pen",
      sellerName: "Modern Scribe",
      description:
        "Solid machined raw brass body with balanced hexagonal barrel, smooth German ceramic rollerball refill, and vintage patina evolution over time.",
      price: 34.0,
      stock: 48,
      productRating: 4.8,
      totalReviews: 44,
      productImage:
        "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&auto=format&fit=crop&q=80",
      category: catMap["books & stationery"],
      isActive: true,
    },

    // Beauty & Wellness
    {
      productName: "Organic Botanical Vitamin C Facial Serum",
      sellerName: "Lumière Botanicals",
      description:
        "Potent antioxidant blend of cold-pressed rosehip seed oil, kakadu plum vitamin C, and plant-derived hyaluronic acid for radiant and hydrated skin.",
      price: 48.0,
      stock: 70,
      productRating: 4.9,
      totalReviews: 106,
      productImage:
        "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80",
      category: catMap["beauty & wellness"],
      isActive: true,
    },
    {
      productName: "Rejuvenating Jade Facial Roller & Gua Sha Set",
      sellerName: "Zenith Home",
      description:
        "Handcrafted 100% natural Xiuyan jade crystal tool kit designed to promote lymphatic drainage, facial muscle relaxation, and serum absorption.",
      price: 24.5,
      stock: 80,
      productRating: 4.7,
      totalReviews: 61,
      productImage:
        "https://images.unsplash.com/photo-1512290900672-1f55a1098616?w=800&auto=format&fit=crop&q=80",
      category: catMap["beauty & wellness"],
      isActive: true,
    },
  ];

  const productDocs = await Product.create(productsData);
  console.log(`🛍️ Seeded ${productDocs.length} products.`);

  // 4. Seed Users
  // Customer User
  const customerUser = await User.create({
    username: "alex_rivera",
    email: "customer@shoppy.com",
    fullName: "Alex Rivera",
    phone: "+1 (555) 234-5678",
    password: "Customer@12345",
    role: "CUSTOMER",
    isActive: true,
    recentlyViewed: [productDocs[0]._id, productDocs[1]._id, productDocs[4]._id],
  });

  // Admin User
  const adminUser = await User.create({
    username: "admin",
    email: "admin@shoppy.com",
    fullName: "Shoppy Admin",
    phone: "+1 (555) 999-0000",
    password: "Admin@12345",
    role: "ADMIN",
    isActive: true,
  });

  // Demo User
  const demoUser = await User.create({
    username: "taylor",
    email: "demo@shoppy.com",
    fullName: "Taylor Swift",
    phone: "+1 (555) 456-7890",
    password: "Demo@12345",
    role: "CUSTOMER",
    isActive: true,
  });

  console.log(`👤 Seeded 3 users (customer, admin, demo).`);

  // 5. Seed Addresses for Customer
  const primaryAddress = await Address.create({
    user: customerUser._id,
    fullName: customerUser.fullName,
    phone: customerUser.phone,
    streetAddress: "742 Evergreen Terrace",
    city: "Springfield",
    state: "OR",
    postalCode: "97477",
    country: "US",
    isDefault: true,
  });

  const secondaryAddress = await Address.create({
    user: customerUser._id,
    fullName: customerUser.fullName,
    phone: "+1 (555) 345-6789",
    streetAddress: "100 Market St, Suite 400",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    country: "US",
    isDefault: false,
  });

  console.log(`🏠 Seeded 2 addresses.`);

  // 6. Seed Orders for Customer
  const headphoneProduct = productDocs[0];
  const watchProduct = productDocs[1];
  const teeProduct = productDocs[5];

  // Order 1: Delivered
  await Order.create({
    orderNumber: "SHP-2026-0001",
    customer: customerUser._id,
    orderItems: [
      {
        productId: headphoneProduct._id,
        productName: headphoneProduct.productName,
        productImage: headphoneProduct.productImage,
        sellerName: headphoneProduct.sellerName,
        unitPrice: headphoneProduct.price,
        quantity: 1,
        lineTotal: headphoneProduct.price,
      },
      {
        productId: teeProduct._id,
        productName: teeProduct.productName,
        productImage: teeProduct.productImage,
        sellerName: teeProduct.sellerName,
        unitPrice: teeProduct.price,
        quantity: 2,
        lineTotal: teeProduct.price * 2,
      },
    ],
    shippingAddress: {
      fullName: primaryAddress.fullName,
      phone: primaryAddress.phone,
      streetAddress: primaryAddress.streetAddress,
      city: primaryAddress.city,
      state: primaryAddress.state,
      postalCode: primaryAddress.postalCode,
      country: primaryAddress.country,
    },
    shippingMethod: "STANDARD",
    subtotal: headphoneProduct.price + teeProduct.price * 2,
    shippingFee: 0,
    tax: Math.round((headphoneProduct.price + teeProduct.price * 2) * 0.08 * 100) / 100,
    totalAmount:
      Math.round(
        (headphoneProduct.price +
          teeProduct.price * 2 +
          (headphoneProduct.price + teeProduct.price * 2) * 0.08) *
          100
      ) / 100,
    status: "DELIVERED",
    carrier: "FedEx Express",
    trackingNumber: "FX-928172918US",
    statusHistory: [
      { status: "CONFIRMED", timestamp: new Date(Date.now() - 5 * 86400000), note: "Order placed & payment verified" },
      { status: "PROCESSING", timestamp: new Date(Date.now() - 4 * 86400000), note: "Packed in fulfilment center" },
      { status: "SHIPPED", timestamp: new Date(Date.now() - 3 * 86400000), note: "Dispatched with FedEx" },
      { status: "DELIVERED", timestamp: new Date(Date.now() - 1 * 86400000), note: "Delivered to recipient porch" },
    ],
  });

  // Order 2: In transit
  await Order.create({
    orderNumber: "SHP-2026-0002",
    customer: customerUser._id,
    orderItems: [
      {
        productId: watchProduct._id,
        productName: watchProduct.productName,
        productImage: watchProduct.productImage,
        sellerName: watchProduct.sellerName,
        unitPrice: watchProduct.price,
        quantity: 1,
        lineTotal: watchProduct.price,
      },
    ],
    shippingAddress: {
      fullName: primaryAddress.fullName,
      phone: primaryAddress.phone,
      streetAddress: primaryAddress.streetAddress,
      city: primaryAddress.city,
      state: primaryAddress.state,
      postalCode: primaryAddress.postalCode,
      country: primaryAddress.country,
    },
    shippingMethod: "EXPRESS",
    subtotal: watchProduct.price,
    shippingFee: 15.0,
    tax: Math.round(watchProduct.price * 0.08 * 100) / 100,
    totalAmount:
      Math.round((watchProduct.price + 15.0 + watchProduct.price * 0.08) * 100) / 100,
    status: "SHIPPED",
    carrier: "UPS Next Day",
    trackingNumber: "1Z999AA10123456784",
    statusHistory: [
      { status: "CONFIRMED", timestamp: new Date(Date.now() - 2 * 86400000), note: "Payment captured" },
      { status: "PROCESSING", timestamp: new Date(Date.now() - 1 * 86400000), note: "Handed over to carrier" },
      { status: "SHIPPED", timestamp: new Date(), note: "In transit to delivery hub" },
    ],
  });

  console.log(`📦 Seeded 2 sample orders.`);

  // 7. Seed Reviews
  await Review.create([
    {
      user: customerUser._id,
      product: headphoneProduct._id,
      order: new mongoose.Types.ObjectId(),
      rating: 5,
      title: "Phenomenal audio & battery life",
      comment:
        "These headphones exceeded every expectation. Soundstage is vast, ANC blocks office hum entirely, and battery easily lasts all work week.",
      status: "PUBLISHED",
      verifiedPurchase: true,
    },
    {
      user: customerUser._id,
      product: teeProduct._id,
      order: new mongoose.Types.ObjectId(),
      rating: 5,
      title: "Best everyday tee I own",
      comment:
        "The Pima cotton is unbelievably soft and maintains its structure after multiple washes without shrinking. Highly recommend!",
      status: "PUBLISHED",
      verifiedPurchase: true,
    },
  ]);

  console.log(`⭐ Seeded verified reviews.`);

  // 8. Seed Notifications
  await Notification.create([
    {
      user: customerUser._id,
      type: "ORDER_DELIVERED",
      title: "Package Delivered!",
      body: "Your order #SHP-2026-0001 has been safely delivered to your front porch.",
      data: { orderNumber: "SHP-2026-0001" },
      isRead: false,
    },
    {
      user: customerUser._id,
      type: "ORDER_SHIPPED",
      title: "Order on the way 🚚",
      body: "Order #SHP-2026-0002 has been dispatched via UPS. Tracking: 1Z999AA10123456784.",
      data: { orderNumber: "SHP-2026-0002" },
      isRead: false,
    },
    {
      user: customerUser._id,
      type: "PROMOTION",
      title: "Exclusive 15% Welcome Discount 🎉",
      body: "Use promo code SHOPELEVATE at checkout to save 15% on your next purchase.",
      isRead: true,
      readAt: new Date(Date.now() - 86400000),
    },
  ]);

  console.log(`🔔 Seeded notifications.`);

  // 9. Seed Cart & Wishlist for customer
  await Cart.create({
    user: customerUser._id,
    items: [
      { product: productDocs[2]._id, quantity: 1 },
      { product: productDocs[6]._id, quantity: 1 },
    ],
  });

  await Wishlist.create({
    user: customerUser._id,
    products: [productDocs[3]._id, productDocs[7]._id, productDocs[11]._id],
  });

  console.log(`🛒 Seeded active cart and wishlist for customer.`);

  return {
    categories: categoryDocs.length,
    products: productDocs.length,
    users: 3,
    addresses: 2,
    orders: 2,
    reviews: 2,
    notifications: 3,
  };
};

// Self-executing runner if invoked via CLI
if (process.argv[1]?.endsWith("unified.seed.js")) {
  const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017";
  const uri = `${mongoUrl}/${DB_NAME}`;
  console.log(`Connecting to MongoDB at: ${uri}`);
  mongoose
    .connect(uri, { serverSelectionTimeoutMS: 5000 })
    .then(async () => {
      const summary = await seedDatabase();
      console.log("\n✅ Database seeded successfully!", summary);
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Database seeding failed:", err.message || err);
      process.exit(1);
    });
}
