const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { connectDB, getProductFromDB, saveProductToDB } = require("./db");

const app = express();
const PORT = process.env.PORT || 8000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 2592000; // 30 days

app.use(cors());
app.use(express.json());

// Product class
class Product {
  constructor(asin, title, description, images = [], brand, price, source = "amazon-helper") {
    this.asin = asin.toUpperCase();
    this.title = title;
    this.description = description;
    this.images = images;
    this.brand = brand;
    this.price = price;
    this.last_updated = new Date().toISOString();
    this.source = source;
  }
}

// Check if product data is stale
function isStale(lastUpdated) {
  const now = new Date().getTime();
  const updated = new Date(lastUpdated).getTime();
  return (now - updated) > (CACHE_TTL * 1000);
}

// Fetch product from amazon-helper API
async function fetchProductFromProvider(asin) {
  try {
    const url = `https://amazon-helper.vercel.app/api/items?asin=${encodeURIComponent(asin)}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    const item = response.data?.ItemsResult?.Items?.[0];
    if (!item) {
      console.log(`❌ No item found for ${asin}`);
      return null;
    }

    // Extract fields
    let title = item.ItemInfo?.Title?.DisplayValue || "Unknown";
    const brand =
      item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ||
      item.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue ||
      "Unbranded";

    if (brand && title.toLowerCase().includes(brand.toLowerCase())) {
      title = title.replace(new RegExp(brand, "ig"), "").trim();
    }

    let price = item.Offers?.Listings?.[0]?.Price?.DisplayAmount || "Price not available";
    price = (price + "").split(" ")[0];

    const description = (item.ItemInfo?.Features?.DisplayValues || []).join("\n");

    const allImages = [];
    if (item.Images?.Primary?.Large?.URL) {
      allImages.push(item.Images.Primary.Large.URL);
    }
    if (item.Images?.Variants) {
      item.Images.Variants.forEach(img => {
        if (img?.Large?.URL && !allImages.includes(img.Large.URL)) {
          allImages.push(img.Large.URL);
        }
      });
    }
    if (item.Images?.Alternate) {
      item.Images.Alternate.forEach(img => {
        if (img?.Large?.URL && !allImages.includes(img.Large.URL)) {
          allImages.push(img.Large.URL);
        }
      });
    }

    return new Product(asin, title, description, allImages, brand, price, "amazon-helper");
  } catch (err) {
    console.error(`❌ Error fetching ${asin}:`, err.message);
    return null;
  }
}

// Get single product
app.get("/product/:asin", async (req, res) => {
  const { asin } = req.params;

  try {
    // Check database first
    let product = await getProductFromDB(asin);
    
    if (product && !isStale(product.last_updated)) {
      console.log(`✅ Returned from DB: ${asin}`);
      return res.json(product);
    }

    // Fetch from provider if not in DB or stale
    product = await fetchProductFromProvider(asin);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Save to database
    await saveProductToDB(product);
    console.log(`✅ Saved to DB: ${asin}`);

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get multiple products (batch)
app.post("/products", async (req, res) => {
  const { asins } = req.body;
  if (!Array.isArray(asins)) {
    return res.status(400).json({ error: "asins must be an array" });
  }

  try {
    const results = await Promise.all(
      asins.map(async (asin) => {
        // Check DB first
        let product = await getProductFromDB(asin);
        
        if (product && !isStale(product.last_updated)) {
          return product;
        }

        // Fetch from provider
        product = await fetchProductFromProvider(asin);
        if (product) {
          await saveProductToDB(product);
        }

        return product || new Product(asin, "Not found", "", [], "", "");
      })
    );
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ message: "ASIN lookup API running" });
});

// Start server
async function startServer() {
  await connectDB();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
  });
}

startServer();