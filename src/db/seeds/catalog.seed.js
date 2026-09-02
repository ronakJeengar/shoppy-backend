import mongoose from "mongoose";
import dotenv from "dotenv";
import { Category } from "../../models/category.model.js";
import { Product } from "../../models/product.model.js";

dotenv.config();

export const seedCatalogData = async () => {
  const categoriesData = [
    { name: "electronics" },
    { name: "fashion" },
    { name: "home & kitchen" },
    { name: "sports & outdoors" },
    { name: "books & stationery" },
  ];

  const categoryDocs = [];
  for (const cat of categoriesData) {
    let existing = await Category.findOne({ name: cat.name });
    if (!existing) {
      existing = await Category.create(cat);
    }
    categoryDocs.push(existing);
  }

  const electronicsCat = categoryDocs.find((c) => c.name === "electronics");
  const fashionCat = categoryDocs.find((c) => c.name === "fashion");
  const homeCat = categoryDocs.find((c) => c.name === "home & kitchen");
  const sportsCat = categoryDocs.find((c) => c.name === "sports & outdoors");
  const booksCat = categoryDocs.find((c) => c.name === "books & stationery");

  const sampleProducts = [
    {
      productName: "Wireless Noise-Cancelling Headphones",
      sellerName: "SoundTech Official",
      description:
        "High-fidelity wireless headphones with dynamic 40mm drivers, active noise cancellation, 30-hour battery life, and comfortable memory foam earcups.",
      price: 149.99,
      stock: 45,
      productRating: 4.8,
      productImage:
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
      category: electronicsCat._id,
    },
    {
      productName: "Smart Fitness Watch Ultra",
      sellerName: "PulseTech Wearables",
      description:
        "Advanced health monitoring smartwatch featuring heart rate tracking, blood oxygen sensor, GPS route tracking, and water resistance up to 50m.",
      price: 199.99,
      stock: 28,
      productRating: 4.6,
      productImage:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
      category: electronicsCat._id,
    },
    {
      productName: "Classic Organic Cotton Crewneck",
      sellerName: "Urban Threads Co.",
      description:
        "Tailored 100% certified organic cotton tee with reinforced stitching, pre-shrunk fabric, and a soft-brushed premium finish.",
      price: 29.99,
      stock: 120,
      productRating: 4.7,
      productImage:
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
      category: fashionCat._id,
    },
    {
      productName: "Minimalist Leather Minimalist Wallet",
      sellerName: "Craft & Hide",
      description:
        "Handcrafted full-grain leather wallet with RFID blocking technology, 6 card slots, and an ultra-slim modern profile.",
      price: 39.5,
      stock: 65,
      productRating: 4.9,
      productImage:
        "https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80",
      category: fashionCat._id,
    },
    {
      productName: "Precision Pour-Over Coffee Dripper",
      sellerName: "Artisan Brewware",
      description:
        "Ceramic pour-over cone designed with spiral ribs for optimal extraction flow rate. Includes reusable stainless steel mesh filter.",
      price: 34.0,
      stock: 50,
      productRating: 4.5,
      productImage:
        "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&q=80",
      category: homeCat._id,
    },
    {
      productName: "Pro Insulated Stainless Water Bottle 1L",
      sellerName: "Summit Outdoors",
      description:
        "Double-walled vacuum insulated thermal flask keeping liquids icy cold for 24 hours or steaming hot for 12 hours. BPA-free leakproof lid.",
      price: 24.99,
      stock: 80,
      productRating: 4.9,
      productImage:
        "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80",
      category: sportsCat._id,
    },
    {
      productName: "Hardcover Dotted Grid Journal",
      sellerName: "PaperCraft Studio",
      description:
        "Premium 120gsm fountain-pen friendly archival paper, expanding back pocket, dual ribbon bookmarks, and durable vegan leather cover.",
      price: 18.5,
      stock: 90,
      productRating: 4.8,
      productImage:
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80",
      category: booksCat._id,
    },
  ];

  for (const item of sampleProducts) {
    const existing = await Product.findOne({
      productName: item.productName,
    });
    if (!existing) {
      await Product.create(item);
    }
  }

  return { categories: categoryDocs.length, products: sampleProducts.length };
};

// Self-executing if called directly from CLI
if (process.argv[1]?.endsWith("catalog.seed.js")) {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/shoppy";
  console.log("Connecting to MongoDB for catalog seed at:", uri);
  mongoose
    .connect(uri)
    .then(async () => {
      const res = await seedCatalogData();
      console.log("Catalog seeded successfully:", res);
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding failed:", err.message);
      process.exit(1);
    });
}
