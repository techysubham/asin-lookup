const mongoose = require('mongoose');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/asin_lookup";

async function connectDB() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log("URI:", process.env.MONGO_URI ? "***hidden***" : "not set");
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log("✅ MongoDB connected successfully with Mongoose!");
    return true;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    return false;
  }
}

async function getProductFromDB(asin) {
  try {
    return await Product.findByAsin(asin);
  } catch (err) {
    console.error("DB read error:", err);
    return null;
  }
}

async function saveProductToDB(productData) {
  try {
    const product = await Product.upsertProduct(productData);
    return product;
  } catch (err) {
    console.error("DB write error:", err.message);
    return false;
  }
}

// Get all products with optional filters
async function getAllProducts(filters = {}, limit = 100, skip = 0) {
  try {
    return await Product.find(filters)
      .sort({ last_updated: -1 })
      .limit(limit)
      .skip(skip);
  } catch (err) {
    console.error("DB query error:", err);
    return [];
  }
}

// Get product statistics
async function getProductStats() {
  try {
    const totalProducts = await Product.countDocuments();
    const productsWithRatings = await Product.countDocuments({ rating: { $ne: null } });
    const avgRating = await Product.aggregate([
      { $match: { rating: { $ne: null } } },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } }
    ]);
    
    return {
      totalProducts,
      productsWithRatings,
      averageRating: avgRating[0]?.avgRating || 0
    };
  } catch (err) {
    console.error("Stats error:", err);
    return null;
  }
}

module.exports = { 
  connectDB, 
  getProductFromDB, 
  saveProductToDB,
  getAllProducts,
  getProductStats,
  Product
};