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
import { Coupon } from "../../models/coupon.model.js";
import { Campaign } from "../../models/campaign.model.js";
import { calculateOrderTax } from "../../services/tax.service.js";

dotenv.config();

export const seedDatabase = async () => {
  // Guard: Never run destructive seed in production
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot seed database in production environment!");
  }

  console.log("🌱 Starting unified database seeding (Indian GST & INR)...");

  // 1. Clear existing non-user data & seeded dev users
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
    Coupon.deleteMany({}),
    Campaign.deleteMany({}),
  ]);

  console.log("🧹 Cleared all collections.");

  // 2. Seed Categories
  const categoryDocs = await Category.create([
    { name: "electronics" },
    { name: "furniture" },
    { name: "fashion" },
    { name: "home & kitchen" },
    { name: "beauty" },
    { name: "sports" },
    { name: "accessories" },
    { name: "books & stationery" },
  ]);

  const catMap = {};
  for (const c of categoryDocs) {
    catMap[c.name] = c._id;
  }
  console.log(`📦 Seeded ${categoryDocs.length} categories.`);

  // 3. Seed Products (38 realistic e-commerce products with INR prices, MRPs, HSN codes, and GST rates)
  const productsData = [
    // --- Electronics (18% GST) ---
    {
      productName: "Aura Pro Wireless Noise-Cancelling Headphones",
      sellerName: "Aura Audio Labs",
      description:
        "Premium over-ear studio headphones with hybrid active noise cancellation, custom 40mm titanium drivers, 35-hour battery life, and ultra-plush memory foam cushions.",
      price: 14999.0,
      mrp: 19999.0,
      hsnCode: "8518",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 55,
      productRating: 4.9,
      totalReviews: 128,
      productImage:
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
      images: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80",
      ],
      videoUrl:
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      category: catMap["electronics"],
      isActive: true,
    },
    {
      productName: "Titan Chronos Ultra Smartwatch",
      sellerName: "Titan Wearables",
      description:
        "Sapphire crystal display smartwatch featuring dual-frequency GPS, ECG monitor, continuous body temperature tracking, 100m water resistance, and 7-day battery endurance.",
      price: 17999.0,
      mrp: 22999.0,
      hsnCode: "8517",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 42,
      productRating: 4.8,
      totalReviews: 94,
      productImage:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
      images: [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop&q=80",
      ],
      videoUrl:
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      category: catMap["electronics"],
      isActive: true,
    },
    {
      productName: "Lumix Portable Bluetooth 360 Speaker",
      sellerName: "Lumix Sound",
      description:
        "IP67 dustproof and waterproof cylindrical speaker delivering 360-degree immersive acoustic sound, punchy bass radiators, and built-in power bank functionality.",
      price: 4999.0,
      mrp: 6999.0,
      hsnCode: "8518",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 4, // Low stock
      productRating: 4.7,
      totalReviews: 52,
      productImage:
        "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=80",
      images: [
        "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80",
      ],
      category: catMap["electronics"],
      isActive: true,
    },
    {
      productName: "PixelClear 4K HDR USB-C Monitor 27\"",
      sellerName: "VisionTech Displays",
      description:
        "Ultra-slim bezel 27-inch IPS display with 99% DCI-P3 color accuracy, HDR400 certified, 90W power delivery over USB-C, and ergonomic pivot stand.",
      price: 28999.0,
      mrp: 34999.0,
      hsnCode: "8528",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: false,
      stock: 0, // Out of stock
      productRating: 4.6,
      totalReviews: 38,
      productImage:
        "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80",
      images: [
        "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80",
      ],
      category: catMap["electronics"],
      isActive: true,
    },
    {
      productName: "SonicBeam Magnetic Wireless Power Bank 10000mAh",
      sellerName: "PowerLink Labs",
      description:
        "Pocket-sized Qi2 magnetic wireless battery pack with kickstand, 20W PD fast-charging USB-C port, and LED battery display.",
      price: 1899.0,
      mrp: 2499.0,
      hsnCode: "8507",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 65,
      productRating: 4.7,
      totalReviews: 81,
      productImage:
        "https://images.unsplash.com/photo-1609592807664-84d5df68b6b1?w=800&auto=format&fit=crop&q=80",
      category: catMap["electronics"],
      isActive: true,
    },

    // --- Furniture (18% GST) ---
    {
      productName: "Ergonomic Mesh High-Back Executive Chair",
      sellerName: "Nordic Posture",
      description:
        "Breathable elastomeric mesh task chair with 4D adjustable armrests, adaptive lumbar support, smooth synchronous tilt, and aluminum base.",
      price: 12999.0,
      mrp: 16999.0,
      hsnCode: "9403",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: false,
      stock: 15,
      productRating: 4.8,
      totalReviews: 62,
      productImage:
        "https://images.unsplash.com/photo-1580481077195-c3a821458312?w=800&auto=format&fit=crop&q=80",
      category: catMap["furniture"],
      isActive: true,
    },
    {
      productName: "Mid-Century Modern Solid Walnut Coffee Table",
      sellerName: "Hygge Living",
      description:
        "Organic surfboard silhouette coffee table crafted from sustainably sourced American walnut with beveled edges and tapered splayed legs.",
      price: 8999.0,
      mrp: 11999.0,
      hsnCode: "9403",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: false,
      stock: 8, // Low stock
      productRating: 4.7,
      totalReviews: 29,
      productImage:
        "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&auto=format&fit=crop&q=80",
      category: catMap["furniture"],
      isActive: true,
    },
    {
      productName: "Minimalist Floating Wall Shelf Trio",
      sellerName: "Hygge Living",
      description:
        "Set of 3 heavy-duty concealed-bracket floating shelves in natural blonde birch. Ideal for books, plants, and accent decor.",
      price: 1499.0,
      mrp: 2499.0,
      hsnCode: "9403",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 0, // Out of stock
      productRating: 4.5,
      totalReviews: 19,
      productImage:
        "https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?w=800&auto=format&fit=crop&q=80",
      category: catMap["furniture"],
      isActive: true,
    },
    {
      productName: "Scandinavian Solid Oak Nightstand",
      sellerName: "Nordic Posture",
      description:
        "Compact bed-side companion with soft-close dovetailed drawer, open lower shelf for books, and integrated cable pass-through.",
      price: 6499.0,
      mrp: 8999.0,
      hsnCode: "9403",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 22,
      productRating: 4.6,
      totalReviews: 34,
      productImage:
        "https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=800&auto=format&fit=crop&q=80",
      category: catMap["furniture"],
      isActive: true,
    },
    {
      productName: "Adjustable Solid Bamboo Standing Desk Converter",
      sellerName: "Nordic Posture",
      description:
        "Pneumatic gas-spring riser transforming any tabletop into a sit-stand workstation. Eco-friendly bamboo surface with dual monitor capacity.",
      price: 7999.0,
      mrp: 10999.0,
      hsnCode: "9403",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 3, // Low stock
      productRating: 4.9,
      totalReviews: 45,
      productImage:
        "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop&q=80",
      category: catMap["furniture"],
      isActive: true,
    },

    // --- Fashion (5% & 12% GST) ---
    {
      productName: "Heavyweight Organic Pima Cotton Oversized Tee",
      sellerName: "Maison Minimal",
      description:
        "280 GSM long-staple Peruvian Pima cotton heavyweight T-shirt with drop-shoulder tailoring, ribbed crew neck, and pre-shrunk finish.",
      price: 999.0,
      mrp: 1499.0,
      hsnCode: "6109",
      gstRate: 5,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 85,
      productRating: 4.8,
      totalReviews: 112,
      productImage:
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
      images: [
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80",
      ],
      category: catMap["fashion"],
      isActive: true,
    },
    {
      productName: "Italian Full-Grain Leather Minimalist Wallet",
      sellerName: "Atelier Vachetta",
      description:
        "Vegetable-tanned Tuscan leather bifold card holder with RFID-blocking shielding, hand-burnished edges, and 8 card slots.",
      price: 1499.0,
      mrp: 2499.0,
      hsnCode: "4202",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 60,
      productRating: 4.9,
      totalReviews: 88,
      productImage:
        "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80",
      category: catMap["fashion"],
      isActive: true,
    },
    {
      productName: "Selvedge Raw Denim Straight-Leg Jeans",
      sellerName: "Maison Minimal",
      description:
        "13.5 oz Japanese Kurabo mill raw selvedge denim. Button-fly closure with custom antique copper hardware and chain-stitched hems.",
      price: 2999.0,
      mrp: 4499.0,
      hsnCode: "6203",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 24,
      productRating: 4.6,
      totalReviews: 57,
      productImage:
        "https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80",
      category: catMap["fashion"],
      isActive: true,
    },
    {
      productName: "Merino Wool Ribbed Knit Beanie",
      sellerName: "Maison Minimal",
      description:
        "100% extrafine Australian Merino wool ribbed cuff beanie. Temperature-regulating, itch-free, and naturally odor resistant.",
      price: 799.0,
      mrp: 1299.0,
      hsnCode: "6505",
      gstRate: 5,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 0, // Out of stock
      productRating: 4.7,
      totalReviews: 41,
      productImage:
        "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&auto=format&fit=crop&q=80",
      category: catMap["fashion"],
      isActive: true,
    },
    {
      productName: "Water-Resistant Commuter City Windbreaker",
      sellerName: "Maison Minimal",
      description:
        "Ultra-lightweight packable storm jacket featuring DWR finish, YKK AquaGuard zippers, vented back yoke, and reflective accents.",
      price: 2499.0,
      mrp: 3999.0,
      hsnCode: "6201",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 5, // Low stock
      productRating: 4.5,
      totalReviews: 36,
      productImage:
        "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80",
      category: catMap["fashion"],
      isActive: true,
    },

    // --- Home & Kitchen (12% & 18% GST) ---
    {
      productName: "Handcrafted Ceramic Pour-Over Coffee Set",
      sellerName: "Kōhī Craft",
      description:
        "Minimalist matte stoneware coffee dripper with spiral extraction channels, ergonomic heat-resistant carafe, and reusable double-layer stainless mesh filter.",
      price: 1499.0,
      mrp: 2199.0,
      hsnCode: "6911",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 40,
      productRating: 4.9,
      totalReviews: 67,
      productImage:
        "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop&q=80",
      category: catMap["home & kitchen"],
      isActive: true,
    },
    {
      productName: "Nordic Minimalist Stoneware Dinnerware Set",
      sellerName: "Hygge Living",
      description:
        "16-piece handcrafted stoneware dining collection with subtle speckled glaze. Microwave, oven, and dishwasher safe.",
      price: 4999.0,
      mrp: 6999.0,
      hsnCode: "6911",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 30,
      productRating: 4.8,
      totalReviews: 41,
      productImage:
        "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&auto=format&fit=crop&q=80",
      category: catMap["home & kitchen"],
      isActive: true,
    },
    {
      productName: "Ultrasonic Essential Oil Aromatherapy Diffuser",
      sellerName: "Zenith Home",
      description:
        "BPA-free real bamboo casing diffuser with whisper-quiet ultrasonic atomization, warm ambient LED glow, and automatic waterless shut-off.",
      price: 1299.0,
      mrp: 1999.0,
      hsnCode: "8509",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 75,
      productRating: 4.7,
      totalReviews: 92,
      productImage:
        "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&auto=format&fit=crop&q=80",
      category: catMap["home & kitchen"],
      isActive: true,
    },
    {
      productName: "Japanese Damascus Steel Chef Knife 8\"",
      sellerName: "Kōhī Craft",
      description:
        "67-layer VG-10 high-carbon Damascus steel blade with octagonal pakkawood handle, razor-sharp 15-degree edge, and wooden saya sheath.",
      price: 3499.0,
      mrp: 4999.0,
      hsnCode: "8211",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 18,
      productRating: 4.9,
      totalReviews: 78,
      productImage:
        "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&auto=format&fit=crop&q=80",
      category: catMap["home & kitchen"],
      isActive: true,
    },
    {
      productName: "Pre-Seasoned Cast Iron Skillet 12\"",
      sellerName: "Hygge Living",
      description:
        "Heavy-duty heirloom cast iron pan triple seasoned with organic flaxseed oil. Superior heat retention with dual pour spouts.",
      price: 1699.0,
      mrp: 2499.0,
      hsnCode: "7323",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 2, // Low stock
      productRating: 4.8,
      totalReviews: 104,
      productImage:
        "https://images.unsplash.com/photo-1584990347449-3972a9b2b52a?w=800&auto=format&fit=crop&q=80",
      category: catMap["home & kitchen"],
      isActive: true,
    },

    // --- Beauty (18% & 28% Luxury GST) ---
    {
      productName: "Organic Botanical Vitamin C Facial Serum",
      sellerName: "Lumière Botanicals",
      description:
        "Potent antioxidant blend of cold-pressed rosehip seed oil, kakadu plum vitamin C, and plant-derived hyaluronic acid for radiant and hydrated skin.",
      price: 1199.0,
      mrp: 1699.0,
      hsnCode: "3304",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 70,
      productRating: 4.9,
      totalReviews: 106,
      productImage:
        "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80",
      category: catMap["beauty"],
      isActive: true,
    },
    {
      productName: "Rejuvenating Jade Facial Roller & Gua Sha Set",
      sellerName: "Zenith Home",
      description:
        "Handcrafted 100% natural Xiuyan jade crystal tool kit designed to promote lymphatic drainage, facial muscle relaxation, and serum absorption.",
      price: 699.0,
      mrp: 1199.0,
      hsnCode: "3304",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 80,
      productRating: 4.7,
      totalReviews: 61,
      productImage:
        "https://images.unsplash.com/photo-1512290900672-1f55a1098616?w=800&auto=format&fit=crop&q=80",
      category: catMap["beauty"],
      isActive: true,
    },
    {
      productName: "Hydrating Peptide Complex Daily Moisturizer",
      sellerName: "Lumière Botanicals",
      description:
        "Lightweight gel-cream infused with 5 multi-weight peptides, ceramides, and centella asiatica to strengthen skin moisture barrier.",
      price: 899.0,
      mrp: 1399.0,
      hsnCode: "3304",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 0, // Out of stock
      productRating: 4.8,
      totalReviews: 53,
      productImage:
        "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=800&auto=format&fit=crop&q=80",
      category: catMap["beauty"],
      isActive: true,
    },
    {
      productName: "Mineral Broad-Spectrum SPF 50 Sunscreen",
      sellerName: "Lumière Botanicals",
      description:
        "Non-nano zinc oxide reef-safe sun cream. Invisible matte finish without white cast, enriched with soothing green tea extract.",
      price: 749.0,
      mrp: 999.0,
      hsnCode: "3304",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 4, // Low stock
      productRating: 4.6,
      totalReviews: 89,
      productImage:
        "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80",
      category: catMap["beauty"],
      isActive: true,
    },
    {
      productName: "Lavender & Sea Salt Exfoliating Body Scrub",
      sellerName: "Zenith Home",
      description:
        "Gentle whipped luxury body polish blending Pacific sea salt with sweet almond oil and Bulgarian lavender essential oil.",
      price: 649.0,
      mrp: 999.0,
      hsnCode: "3307",
      gstRate: 28, // 28% Luxury personal care slab
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 52,
      productRating: 4.7,
      totalReviews: 44,
      productImage:
        "https://images.unsplash.com/photo-1556228722-d0b3d103ca91?w=800&auto=format&fit=crop&q=80",
      category: catMap["beauty"],
      isActive: true,
    },

    // --- Sports (12% & 18% GST) ---
    {
      productName: "Thermal Insulated Stainless Water Bottle 1L",
      sellerName: "Summit Outdoors",
      description:
        "Double-walled vacuum insulated flask keeping ice cold for 28 hours or piping hot for 14 hours. Textured powder-coat grip and leak-proof spout lid.",
      price: 999.0,
      mrp: 1499.0,
      hsnCode: "7323",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 110,
      productRating: 4.9,
      totalReviews: 180,
      productImage:
        "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80",
      category: catMap["sports"],
      isActive: true,
    },
    {
      productName: "High-Density Eco TPE Alignment Yoga Mat",
      sellerName: "Zenith Home",
      description:
        "6mm thick non-slip textured exercise mat with laser-engraved body alignment markers, carrying strap, and biodegradable closed-cell construction.",
      price: 1299.0,
      mrp: 1899.0,
      hsnCode: "9506",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 35,
      productRating: 4.7,
      totalReviews: 73,
      productImage:
        "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&auto=format&fit=crop&q=80",
      category: catMap["sports"],
      isActive: true,
    },
    {
      productName: "Cast Iron Hex Dumbbell Pair 20LB",
      sellerName: "Summit Outdoors",
      description:
        "Heavy-duty rubber-encased hex dumbbells with knurled ergonomic chrome handles. Anti-roll design protects workout floors.",
      price: 2199.0,
      mrp: 2999.0,
      hsnCode: "9506",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: false,
      stock: 0, // Out of stock
      productRating: 4.8,
      totalReviews: 39,
      productImage:
        "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&auto=format&fit=crop&q=80",
      category: catMap["sports"],
      isActive: true,
    },
    {
      productName: "Resistance Exercise Loop Band Set of 5",
      sellerName: "Summit Outdoors",
      description:
        "100% natural Malaysian latex strength loops ranging from X-Light (5lb) to X-Heavy (40lb). Includes breathable mesh storage pouch.",
      price: 499.0,
      mrp: 799.0,
      hsnCode: "9506",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 95,
      productRating: 4.6,
      totalReviews: 115,
      productImage:
        "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=800&auto=format&fit=crop&q=80",
      category: catMap["sports"],
      isActive: true,
    },
    {
      productName: "Quick-Dry Microfiber Compact Gym Towel",
      sellerName: "Summit Outdoors",
      description:
        "Super-absorbent, ultra-lightweight antimicrobial microfiber fitness towel with zip key pocket and hanging loop.",
      price: 399.0,
      mrp: 599.0,
      hsnCode: "6302",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 5, // Low stock
      productRating: 4.5,
      totalReviews: 62,
      productImage:
        "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=800&auto=format&fit=crop&q=80",
      category: catMap["sports"],
      isActive: true,
    },

    // --- Accessories (18% GST) ---
    {
      productName: "Polarized Acetate Classic Sunglasses",
      sellerName: "Atelier Vachetta",
      description:
        "Handcrafted Italian Mazzucchelli acetate frames with Category 3 polarized UV400 lenses and reinforced 5-barrel barrel hinges.",
      price: 2499.0,
      mrp: 3999.0,
      hsnCode: "9004",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 44,
      productRating: 4.8,
      totalReviews: 77,
      productImage:
        "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80",
      category: catMap["accessories"],
      isActive: true,
    },
    {
      productName: "Water-Repellent Ballistic Nylon Laptop Sleeve 14\"",
      sellerName: "Atelier Vachetta",
      description:
        "Padded 1680D Cordura ballistic nylon protective case with magnetic closure, fleece lining, and quick-stash charging cable pocket.",
      price: 999.0,
      mrp: 1499.0,
      hsnCode: "4202",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 38,
      productRating: 4.7,
      totalReviews: 49,
      productImage:
        "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80",
      category: catMap["accessories"],
      isActive: true,
    },
    {
      productName: "Aerospace Titanium Minimalist Carabiner Keychain",
      sellerName: "Modern Scribe",
      description:
        "CNC-milled Grade 5 titanium spring gate carabiner with integrated bottle opener, pry bar, and stainless key split rings.",
      price: 799.0,
      mrp: 1299.0,
      hsnCode: "7326",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 3, // Low stock
      productRating: 4.9,
      totalReviews: 82,
      productImage:
        "https://images.unsplash.com/photo-1528795259021-d8c86e14354c?w=800&auto=format&fit=crop&q=80",
      category: catMap["accessories"],
      isActive: true,
    },
    {
      productName: "Braided Leather Wrap Bracelet",
      sellerName: "Atelier Vachetta",
      description:
        "Double-wrap genuine calfskin leather wristband with brushed matte black surgical steel magnetic clasp.",
      price: 699.0,
      mrp: 1099.0,
      hsnCode: "7117",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 0, // Out of stock
      productRating: 4.4,
      totalReviews: 26,
      productImage:
        "https://images.unsplash.com/photo-1611591475825-985289f81d11?w=800&auto=format&fit=crop&q=80",
      category: catMap["accessories"],
      isActive: true,
    },
    {
      productName: "Genuine Suede Travel Watch Roll",
      sellerName: "Atelier Vachetta",
      description:
        "Cushioned 3-slot watch storage case in supple midnight navy suede with snap closure and removable pillows.",
      price: 1499.0,
      mrp: 2199.0,
      hsnCode: "4202",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 26,
      productRating: 4.8,
      totalReviews: 31,
      productImage:
        "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80",
      category: catMap["accessories"],
      isActive: true,
    },

    // --- Books & Stationery (0% GST Books, 12% & 18% Stationery) ---
    {
      productName: "Vintage Hardcover Dotted Grid Journal 160gsm",
      sellerName: "Modern Scribe",
      description:
        "Bleed-resistant 160 GSM bamboo paper notebook with Smyth-sewn lay-flat binding, dual silk ribbon bookmarks, and expandable rear pocket.",
      price: 499.0,
      mrp: 799.0,
      hsnCode: "4901",
      gstRate: 0, // 0% GST on printed books/journals
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 65,
      productRating: 4.9,
      totalReviews: 83,
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
      price: 899.0,
      mrp: 1299.0,
      hsnCode: "9608",
      gstRate: 18,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 48,
      productRating: 4.8,
      totalReviews: 44,
      productImage:
        "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&auto=format&fit=crop&q=80",
      category: catMap["books & stationery"],
      isActive: true,
    },
    {
      productName: "Wooden Desktop Document & Book Organizer",
      sellerName: "Modern Scribe",
      description:
        "Handcrafted walnut wood desktop tier tray for letters, journals, and tablets with non-slip cork feet.",
      price: 1199.0,
      mrp: 1699.0,
      hsnCode: "4421",
      gstRate: 12,
      isTaxInclusive: true,
      isCodEligible: true,
      stock: 20,
      productRating: 4.6,
      totalReviews: 28,
      productImage:
        "https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?w=800&auto=format&fit=crop&q=80",
      category: catMap["books & stationery"],
      isActive: true,
    },
  ];

  const productDocs = await Product.create(productsData);
  console.log(`🛍️ Seeded ${productDocs.length} products.`);

  // 4. Seed Development Users
  // Customer User
  const customerUser = await User.create({
    username: "alex_rivera",
    email: "customer@shoppy.com",
    fullName: "Alex Rivera",
    phone: "+91 98765 43210",
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
    phone: "+91 98765 00000",
    password: "Admin@12345",
    role: "ADMIN",
    isActive: true,
  });

  // Demo User
  const demoUser = await User.create({
    username: "taylor",
    email: "demo@shoppy.com",
    fullName: "Taylor Swift",
    phone: "+91 98765 11111",
    password: "Demo@12345",
    role: "CUSTOMER",
    isActive: true,
  });

  console.log(`👤 Seeded 3 dev users (customer, admin, demo).`);

  // 5. Seed Indian Addresses for Customer
  const primaryAddress = await Address.create({
    user: customerUser._id,
    fullName: customerUser.fullName,
    phone: customerUser.phone,
    streetAddress: "Flat 402, Lotus Residency, 100ft Road, Indiranagar",
    landmark: "Near Metro Station Pillar 42",
    district: "Bengaluru Urban",
    city: "Bengaluru",
    state: "KARNATAKA",
    pinCode: "560038",
    postalCode: "560038",
    country: "IN",
    isDefault: true,
  });

  const secondaryAddress = await Address.create({
    user: customerUser._id,
    fullName: customerUser.fullName,
    phone: customerUser.phone,
    streetAddress: "Flat 801, DLF Phase 2, Cyber City",
    landmark: "Opposite Cyber Hub",
    district: "Gurugram",
    city: "Gurugram",
    state: "HARYANA",
    pinCode: "122002",
    postalCode: "122002",
    country: "IN",
    isDefault: false,
  });

  console.log(`🏠 Seeded 2 Indian addresses.`);

  // 6. Seed Orders for Customer with authoritative GST calculation
  const headphoneProduct = productDocs[0];
  const watchProduct = productDocs[1];
  const teeProduct = productDocs[10]; // Pima cotton tee

  // Order 1: Intra-state (Karnataka -> Karnataka) - Delivered
  const order1Items = [
    {
      productId: headphoneProduct._id,
      productName: headphoneProduct.productName,
      productImage: headphoneProduct.productImage,
      sellerName: headphoneProduct.sellerName,
      unitPrice: headphoneProduct.price,
      quantity: 1,
      lineTotal: headphoneProduct.price,
      hsnCode: headphoneProduct.hsnCode || "8518",
      gstRate: headphoneProduct.gstRate || 18,
      isTaxInclusive: true,
    },
    {
      productId: teeProduct._id,
      productName: teeProduct.productName,
      productImage: teeProduct.productImage,
      sellerName: teeProduct.sellerName,
      unitPrice: teeProduct.price,
      quantity: 2,
      lineTotal: teeProduct.price * 2,
      hsnCode: teeProduct.hsnCode || "6109",
      gstRate: teeProduct.gstRate || 5,
      isTaxInclusive: true,
    },
  ];

  const order1Tax = calculateOrderTax({
    items: order1Items,
    customerState: primaryAddress.state,
    originState: "KARNATAKA",
    shippingFee: 0,
  });

  const order1 = await Order.create({
    orderNumber: "SHP-2026-0001",
    customer: customerUser._id,
    orderItems: order1Items,
    shippingAddress: {
      fullName: primaryAddress.fullName,
      phone: primaryAddress.phone,
      streetAddress: primaryAddress.streetAddress,
      landmark: primaryAddress.landmark,
      district: primaryAddress.district,
      city: primaryAddress.city,
      state: primaryAddress.state,
      pinCode: primaryAddress.pinCode,
      postalCode: primaryAddress.postalCode,
      country: primaryAddress.country,
    },
    shippingMethod: "STANDARD",
    subtotal: order1Tax.subtotal,
    shippingFee: order1Tax.shippingFee,
    taxableAmount: order1Tax.taxableAmount,
    taxBreakdown: order1Tax.taxBreakdown,
    tax: order1Tax.tax,
    totalAmount: order1Tax.grandTotal,
    currency: "INR",
    status: "DELIVERED",
    carrier: "Blue Dart Express",
    trackingNumber: "BD-928172918IN",
    statusHistory: [
      { status: "CONFIRMED", timestamp: new Date(Date.now() - 5 * 86400000), note: "Order placed & payment verified" },
      { status: "PROCESSING", timestamp: new Date(Date.now() - 4 * 86400000), note: "Packed at Bengaluru fulfilment hub" },
      { status: "SHIPPED", timestamp: new Date(Date.now() - 3 * 86400000), note: "Dispatched via Blue Dart Express" },
      { status: "DELIVERED", timestamp: new Date(Date.now() - 1 * 86400000), note: "Delivered to security gate" },
    ],
  });

  // Order 2: Inter-state (Karnataka -> Haryana) - In transit
  const order2Items = [
    {
      productId: watchProduct._id,
      productName: watchProduct.productName,
      productImage: watchProduct.productImage,
      sellerName: watchProduct.sellerName,
      unitPrice: watchProduct.price,
      quantity: 1,
      lineTotal: watchProduct.price,
      hsnCode: watchProduct.hsnCode || "8517",
      gstRate: watchProduct.gstRate || 18,
      isTaxInclusive: true,
    },
  ];

  const order2Tax = calculateOrderTax({
    items: order2Items,
    customerState: secondaryAddress.state, // HARYANA -> Inter-state IGST
    originState: "KARNATAKA",
    shippingFee: 99.0,
  });

  const order2 = await Order.create({
    orderNumber: "SHP-2026-0002",
    customer: customerUser._id,
    orderItems: order2Items,
    shippingAddress: {
      fullName: secondaryAddress.fullName,
      phone: secondaryAddress.phone,
      streetAddress: secondaryAddress.streetAddress,
      landmark: secondaryAddress.landmark,
      district: secondaryAddress.district,
      city: secondaryAddress.city,
      state: secondaryAddress.state,
      pinCode: secondaryAddress.pinCode,
      postalCode: secondaryAddress.postalCode,
      country: secondaryAddress.country,
    },
    shippingMethod: "EXPRESS",
    subtotal: order2Tax.subtotal,
    shippingFee: order2Tax.shippingFee,
    taxableAmount: order2Tax.taxableAmount,
    taxBreakdown: order2Tax.taxBreakdown,
    tax: order2Tax.tax,
    totalAmount: order2Tax.grandTotal,
    currency: "INR",
    status: "SHIPPED",
    carrier: "Delhivery Surface",
    trackingNumber: "DEL-887123456IN",
    statusHistory: [
      { status: "CONFIRMED", timestamp: new Date(Date.now() - 2 * 86400000), note: "Payment captured" },
      { status: "PROCESSING", timestamp: new Date(Date.now() - 1 * 86400000), note: "Handed over to Delhivery logistics" },
      { status: "SHIPPED", timestamp: new Date(), note: "In transit to Delhi-NCR delivery hub" },
    ],
  });

  console.log(`📦 Seeded 2 sample GST orders (Intra-state CGST/SGST & Inter-state IGST).`);

  // 7. Seed Reviews
  await Review.create([
    {
      user: customerUser._id,
      product: headphoneProduct._id,
      order: order1._id,
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
      order: order1._id,
      rating: 5,
      title: "Best everyday tee I own",
      comment:
        "The Pima cotton is unbelievably soft and maintains its structure after multiple washes without shrinking. Highly recommend!",
      status: "PUBLISHED",
      verifiedPurchase: true,
    },
    {
      user: demoUser._id,
      product: watchProduct._id,
      order: order2._id,
      rating: 5,
      title: "Incredible fitness companion",
      comment:
        "Battery life easily reaches 7 full days with continuous tracking. The sapphire glass is ultra tough and GPS locking is instantaneous.",
      status: "PUBLISHED",
      verifiedPurchase: true,
    },
    {
      user: customerUser._id,
      product: productDocs[2]._id, // Lumix Speaker
      order: order1._id,
      rating: 4,
      title: "Great sound for outdoor trips",
      comment:
        "Remarkably loud for its portable size! Waterproof build came in handy during trips. Very satisfied.",
      status: "PUBLISHED",
      verifiedPurchase: true,
    },
    {
      user: demoUser._id,
      product: productDocs[15]._id, // Handcrafted Ceramic Pour-Over
      order: order1._id,
      rating: 5,
      title: "Elevated my morning brew routine",
      comment:
        "The ceramic retains temperature perfectly during extraction. It is as much an art piece on the counter as it is functional.",
      status: "PUBLISHED",
      verifiedPurchase: true,
    },
  ]);

  console.log(`⭐ Seeded 5 verified reviews.`);

  // 8. Seed Notifications
  await Notification.create([
    {
      user: customerUser._id,
      type: "ORDER_DELIVERED",
      title: "Package Delivered!",
      body: "Your order #SHP-2026-0001 has been safely delivered via Blue Dart.",
      data: { orderNumber: "SHP-2026-0001" },
      isRead: false,
    },
    {
      user: customerUser._id,
      type: "ORDER_SHIPPED",
      title: "Order on the way 🚚",
      body: "Order #SHP-2026-0002 has been dispatched via Delhivery. Tracking: DEL-887123456IN.",
      data: { orderNumber: "SHP-2026-0002" },
      isRead: false,
    },
    {
      user: customerUser._id,
      type: "PROMOTION",
      title: "Exclusive Welcome Offer 🎉",
      body: "Shop authentic Indian e-commerce with all taxes included upfront.",
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
      { product: productDocs[11]._id, quantity: 1 },
    ],
  });

  await Wishlist.create({
    user: customerUser._id,
    products: [productDocs[0]._id, productDocs[5]._id, productDocs[15]._id],
  });

  console.log(`🛒 Seeded active cart and wishlist for customer.`);

  // 10. Seed Realistic Indian E-Commerce Coupons
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const couponDocs = await Coupon.create([
    {
      code: "WELCOME10",
      name: "Welcome 10% Off",
      description: "Get 10% off up to ₹250 on your first purchase above ₹499",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minimumOrderValue: 499,
      maximumDiscountAmount: 250,
      startAt: lastMonth,
      expiresAt: nextYear,
      isActive: true,
      usageLimit: 10000,
      perUserLimit: 1,
      firstOrderOnly: true,
    },
    {
      code: "FLAT500",
      name: "Flat ₹500 Off",
      description: "Flat ₹500 discount on orders above ₹2,499",
      discountType: "FIXED",
      discountValue: 500,
      minimumOrderValue: 2499,
      maximumDiscountAmount: null,
      startAt: lastMonth,
      expiresAt: nextYear,
      isActive: true,
      usageLimit: 5000,
      perUserLimit: 2,
      firstOrderOnly: false,
    },
    {
      code: "FESTIVE20",
      name: "Festive Dhamaka 20% Off",
      description: "20% off up to ₹1,000 on orders above ₹999",
      discountType: "PERCENTAGE",
      discountValue: 20,
      minimumOrderValue: 999,
      maximumDiscountAmount: 1000,
      startAt: lastMonth,
      expiresAt: nextMonth,
      isActive: true,
      usageLimit: 2000,
      perUserLimit: 1,
      firstOrderOnly: false,
    },
    {
      code: "FREESHIP",
      name: "Shipping Discount",
      description: "Flat ₹100 off on all orders above ₹499",
      discountType: "FIXED",
      discountValue: 100,
      minimumOrderValue: 499,
      maximumDiscountAmount: null,
      startAt: lastMonth,
      expiresAt: nextYear,
      isActive: true,
      usageLimit: null,
      perUserLimit: 5,
      firstOrderOnly: false,
    },
    {
      code: "SUMMER15",
      name: "Summer Savings 15%",
      description: "15% off up to ₹500 on all orders above ₹799",
      discountType: "PERCENTAGE",
      discountValue: 15,
      minimumOrderValue: 799,
      maximumDiscountAmount: 500,
      startAt: lastMonth,
      expiresAt: nextMonth,
      isActive: true,
      usageLimit: 1000,
      perUserLimit: 2,
      firstOrderOnly: false,
    },
    {
      code: "EXPIRED10",
      name: "Expired Promo 10%",
      description: "Testing expired coupon code",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minimumOrderValue: 200,
      maximumDiscountAmount: 100,
      startAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      expiresAt: lastMonth,
      isActive: true,
      usageLimit: 100,
      perUserLimit: 1,
      firstOrderOnly: false,
    },
    {
      code: "INACTIVE50",
      name: "Inactive Super 50%",
      description: "Testing inactive coupon code",
      discountType: "PERCENTAGE",
      discountValue: 50,
      minimumOrderValue: 100,
      maximumDiscountAmount: 500,
      startAt: lastMonth,
      expiresAt: nextYear,
      isActive: false,
      usageLimit: 100,
      perUserLimit: 1,
      firstOrderOnly: false,
    },
  ]);

  console.log(`🎟️ Seeded ${couponDocs.length} coupons.`);

  // 11. Seed Campaigns / Sale Banners (Feature 3)
  const campaignDocs = await Campaign.create([
    {
      title: "Diwali Dhamaka Sale — Up to 50% Off",
      subtitle: "Celebrate festive joy with mega savings on top electronics and fashion",
      description: "Exclusive festive discounts, instant bank offers, and limited-time coupons on premium brands.",
      bannerImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200&auto=format&fit=crop&q=80",
      mobileImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600&auto=format&fit=crop&q=80",
      desktopImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200&auto=format&fit=crop&q=80",
      campaignType: "FESTIVAL",
      startAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      endAt: nextMonth,
      isActive: true,
      priority: 10,
      displayOrder: 1,
      targetType: "CATEGORY",
      targetId: "electronics",
      ctaLabel: "Shop Festive Sale",
      ctaAction: {
        type: "CATEGORY",
        value: "electronics",
      },
      couponCode: "FESTIVE20",
      metadata: {
        tag: "FESTIVAL SPECIAL",
        bgGradient: "amber",
        accentColor: "#F59E0B",
      },
    },
    {
      title: "Next-Gen Sound & Audio Labs",
      subtitle: "Explore noise-cancelling headphones, soundbars & studio gear",
      description: "State-of-the-art acoustics and high-fidelity audio equipment with official brand warranties.",
      bannerImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80",
      mobileImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
      desktopImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80",
      campaignType: "NEW_ARRIVAL",
      startAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      endAt: nextMonth,
      isActive: true,
      priority: 8,
      displayOrder: 2,
      targetType: "CATEGORY",
      targetId: "electronics",
      ctaLabel: "Explore Audio",
      ctaAction: {
        type: "CATEGORY",
        value: "electronics",
      },
      couponCode: null,
      metadata: {
        tag: "NEW ARRIVALS",
        bgGradient: "indigo",
        accentColor: "#4F46E5",
      },
    },
    {
      title: "Modern Living & Artisan Home",
      subtitle: "Elevate your space with handcrafted cookware & designer accents",
      description: "Curated collection of modern kitchenware, ergonomic dining pieces, and artisan ceramics.",
      bannerImage: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&auto=format&fit=crop&q=80",
      mobileImage: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80",
      desktopImage: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&auto=format&fit=crop&q=80",
      campaignType: "SALE",
      startAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      endAt: nextMonth,
      isActive: true,
      priority: 5,
      displayOrder: 3,
      targetType: "COUPON",
      targetId: "FLAT500",
      ctaLabel: "Use FLAT500",
      ctaAction: {
        type: "COUPON",
        value: "FLAT500",
      },
      couponCode: "FLAT500",
      metadata: {
        tag: "LIMITED OFFER",
        bgGradient: "slate",
        accentColor: "#0F172A",
      },
    },
    {
      title: "Monsoon Clearance Blowout",
      subtitle: "Past promotional offer archive",
      description: "Expired promotional sale testing schedule validity.",
      bannerImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
      mobileImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&auto=format&fit=crop&q=80",
      desktopImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
      campaignType: "SEASONAL",
      startAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      endAt: lastMonth,
      isActive: true,
      priority: 1,
      displayOrder: 4,
      targetType: "CATEGORY",
      targetId: "fashion",
      ctaLabel: "View Clearance",
      ctaAction: {
        type: "CATEGORY",
        value: "fashion",
      },
      couponCode: null,
      metadata: {
        tag: "EXPIRED",
        bgGradient: "slate",
      },
    },
    {
      title: "Republic Day Mega Sale Preview",
      subtitle: "Great Indian patriotic sale preview",
      description: "Future scheduled campaign testing upcoming scheduling.",
      bannerImage: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&auto=format&fit=crop&q=80",
      mobileImage: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80",
      desktopImage: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&auto=format&fit=crop&q=80",
      campaignType: "FESTIVAL",
      startAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      endAt: nextYear,
      isActive: true,
      priority: 15,
      displayOrder: 1,
      targetType: "HOME",
      targetId: "",
      ctaLabel: "Notify Me",
      ctaAction: {
        type: "HOME",
        value: "",
      },
      couponCode: null,
      metadata: {
        tag: "UPCOMING",
        bgGradient: "amber",
      },
    },
    {
      title: "Deactivated General Banner",
      subtitle: "Manually turned off campaign",
      description: "Test inactive campaign status filtering.",
      bannerImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
      mobileImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&auto=format&fit=crop&q=80",
      desktopImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
      campaignType: "GENERAL",
      startAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      endAt: nextMonth,
      isActive: false,
      priority: 2,
      displayOrder: 5,
      targetType: "HOME",
      targetId: "",
      ctaLabel: "Learn More",
      ctaAction: {
        type: "HOME",
        value: "",
      },
      couponCode: null,
      metadata: {},
    },
  ]);

  console.log(`🎯 Seeded ${campaignDocs.length} campaigns/banners.`);

  return {
    categories: categoryDocs.length,
    products: productDocs.length,
    users: 3,
    addresses: 2,
    orders: 2,
    reviews: 5,
    notifications: 3,
    coupons: couponDocs.length,
    campaigns: campaignDocs.length,
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
