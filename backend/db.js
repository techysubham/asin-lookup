const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = "asin_lookup";
const COLLECTION_NAME = "products";

let db = null;
let productsCollection = null;

async function connectDB() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log("URI:", process.env.MONGO_URI ? "***hidden***" : "not set");
    
    const client = new MongoClient(MONGO_URI, { 
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    productsCollection = db.collection(COLLECTION_NAME);
    
    await productsCollection.createIndex({ asin: 1 });
    
    console.log("✅ MongoDB Atlas connected successfully!");
    return productsCollection;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    return null;
  }
}

async function getProductFromDB(asin) {
  if (!productsCollection) return null;
  try {
    return await productsCollection.findOne({ asin: asin.toUpperCase() });
  } catch (err) {
    console.error("DB read error:", err);
    return null;
  }
}

async function saveProductToDB(product) {
  if (!productsCollection) return false;
  try {
    await productsCollection.updateOne(
      { asin: product.asin },
      { $set: product },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error("DB write error:", err);
    return false;
  }
}

module.exports = { connectDB, getProductFromDB, saveProductToDB, productsCollection: () => productsCollection };