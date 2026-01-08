const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const { connectDB, getProductFromDB, saveProductToDB, Product } = require("./db");
const Account = require("./models/Account");
const { generateEbayContent } = require("./services/aiService");
const { processMultipleImages } = require("./services/imageService");

const app = express();
const PORT = process.env.PORT || 8000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 2592000; // 30 days

// Serve static files from public directory
app.use('/processed', express.static(path.join(__dirname, 'public/processed')));
app.use('/overlays', express.static(path.join(__dirname, 'public/overlays')));

// Enhanced CORS configuration
app.use(cors({
  origin: ['https://asin-lookup.vercel.app', 'http://localhost:5173', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

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
    console.log(`Fetching ${asin} from provider...`);
    const response = await axios.get(url, { 
      timeout: 30000, // 30 seconds for mobile networks
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
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

    // Extract rating and review count
    const rating = item.CustomerReviews?.StarRating?.Value || null;
    const reviewCount = item.CustomerReviews?.Count || 0;

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

    return {
      asin: asin.toUpperCase(),
      title,
      description,
      images: allImages,
      brand,
      price,
      rating,
      reviewCount,
      source: "amazon-helper"
    };
  } catch (err) {
    console.error(`❌ Error fetching ${asin}:`, err.message);
    return null;
  }
}

// Get single product
app.get("/product/:asin", async (req, res) => {
  const { asin } = req.params;
  const { regenerate } = req.query; // Add query param to force regeneration

  try {
    // Check database first
    let product = await getProductFromDB(asin);
    
    if (product && !isStale(product.last_updated)) {
      console.log(`✅ Returned from DB: ${asin}`);
      
      // Generate eBay content if missing OR if regenerate is requested
      if (!product.ebay || !product.ebay.title || regenerate === 'true') {
        console.log(`🤖 Generating ${regenerate === 'true' ? 'updated' : 'missing'} eBay content for ${asin}...`);
        try {
          const ebayContent = await generateEbayContent({
            asin: product.asin || asin,
            title: product.title,
            brand: product.brand,
            description: product.description,
            price: product.price,
            images: product.images
          });
          product.ebay = ebayContent;
          console.log(`🔍 Generated eBay content:`, ebayContent);
          await saveProductToDB(product);
          console.log(`✅ eBay content generated and saved for ${asin}`);
          // Refetch from DB to get the updated product with ebay field
          product = await getProductFromDB(asin);
        } catch (aiError) {
          console.error(`⚠️ AI generation failed for ${asin}:`, aiError.message);
        }
      }
      
      console.log(`📤 Returning product:`, JSON.stringify(product, null, 2));
      return res.json(product);
    }

    // Fetch from provider if not in DB or stale
    product = await fetchProductFromProvider(asin);
    if (!product) {
      console.log(`Product ${asin} not found in API`);
      return res.status(404).json({ 
        error: "Product not found",
        message: "Unable to fetch product data from Amazon API. Please verify the ASIN is correct."
      });
    }

    // Generate eBay content using AI
    console.log(`🤖 Generating eBay content for ${asin}...`);
    try {
      const ebayContent = await generateEbayContent({
        asin: product.asin || asin,
        title: product.title,
        brand: product.brand,
        description: product.description,
        price: product.price,
        images: product.images
      });
      product.ebay = ebayContent;
      console.log(`✅ eBay content generated for ${asin}`);
    } catch (aiError) {
      console.error(`⚠️ AI generation failed for ${asin}:`, aiError.message);
      product.ebay = {
        title: null,
        description: null,
        image: null
      };
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

  if (asins.length === 0) {
    return res.status(400).json({ error: "asins array cannot be empty" });
  }

  if (asins.length > 20) {
    return res.status(400).json({ error: "Maximum 20 ASINs allowed per request" });
  }

  try {
    const results = await Promise.all(
      asins.map(async (asin) => {
        // Check DB first
        let product = await getProductFromDB(asin);
        
        if (product && !isStale(product.last_updated)) {
          console.log(`✅ Found ${asin} in DB, checking eBay data...`);
          // Generate eBay content if missing
          if (!product.ebay || !product.ebay.title) {
            console.log(`🤖 eBay data missing for ${asin}, generating now...`);
            try {
              const ebayContent = await generateEbayContent({
                title: product.title,
                brand: product.brand,
                description: product.description,
                price: product.price
              });
              product.ebay = ebayContent;
              await saveProductToDB(product);
              // Refetch to get updated product
              product = await getProductFromDB(asin);
            } catch (aiError) {
              console.error(`⚠️ AI generation failed for ${asin}:`, aiError.message);
            }
          }
          return product;
        }

        // Fetch from provider
        product = await fetchProductFromProvider(asin);
        if (product) {
          console.log(`📦 Fetched new product ${asin}, now generating eBay content...`);
          // Generate eBay content using AI
          try {
            const ebayContent = await generateEbayContent({
              title: product.title,
              brand: product.brand,
              description: product.description,
              price: product.price
            });
            product.ebay = ebayContent;
          } catch (aiError) {
            console.error(`⚠️ AI generation failed for ${asin}:`, aiError.message);
            product.ebay = {
              title: null,
              description: null,
              image: null
            };
          }
          await saveProductToDB(product);
        }

        return product || {
          asin: asin.toUpperCase(),
          title: "Not found",
          description: "",
          images: [],
          brand: "",
          price: "",
          rating: null,
          reviewCount: 0,
          source: "amazon-helper"
        };
      })
    );
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ Account Management APIs ============

// Get all accounts
app.get("/accounts", async (req, res) => {
  try {
    const accounts = await Account.find().sort({ name: 1 });
    res.json(accounts);
  } catch (err) {
    console.error("Error fetching accounts:", err);
    res.status(500).json({ error: err.message });
  }
});

// Create new account
app.post("/accounts", async (req, res) => {
  try {
    const { name, email, description, status } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const existingAccount = await Account.findOne({ 
      $or: [{ name }, { email }] 
    });
    
    if (existingAccount) {
      return res.status(409).json({ 
        error: "Account with this name or email already exists" 
      });
    }

    const account = new Account({
      name,
      email,
      description: description || '',
      status: status || 'active'
    });

    await account.save();
    console.log(`✅ New account created: ${name}`);
    res.status(201).json(account);
  } catch (err) {
    console.error("Error creating account:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get account by ID
app.get("/accounts/:id", async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(account);
  } catch (err) {
    console.error("Error fetching account:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update account
app.put("/accounts/:id", async (req, res) => {
  try {
    const { name, email, description, status } = req.body;
    const account = await Account.findByIdAndUpdate(
      req.params.id,
      { name, email, description, status },
      { new: true, runValidators: true }
    );
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    console.log(`✅ Account updated: ${account.name}`);
    res.json(account);
  } catch (err) {
    console.error("Error updating account:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete account
app.delete("/accounts/:id", async (req, res) => {
  try {
    const account = await Account.findByIdAndDelete(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    // Optionally unlink products from this account
    await Product.updateMany(
      { accountId: req.params.id },
      { $set: { accountId: null } }
    );
    
    console.log(`✅ Account deleted: ${account.name}`);
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Error deleting account:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get products by account ID
app.get("/accounts/:id/products", async (req, res) => {
  try {
    const products = await Product.find({ accountId: req.params.id })
      .sort({ last_updated: -1 });
    res.json(products);
  } catch (err) {
    console.error("Error fetching account products:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update product (for editing in the table)
app.put("/products/:asin", async (req, res) => {
  try {
    const { asin } = req.params;
    const updates = req.body;
    
    const product = await Product.findOneAndUpdate(
      { asin: asin.toUpperCase() },
      { ...updates, last_updated: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    console.log(`✅ Product updated: ${asin}`);
    res.json(product);
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: err.message });
  }
});

// Assign product to account
app.post("/products/:asin/assign", async (req, res) => {
  try {
    const { asin } = req.params;
    const { accountId } = req.body;
    
    // Check if product exists and is already assigned to the SAME account
    const existingProduct = await Product.findOne({ asin: asin.toUpperCase() });
    
    if (existingProduct && existingProduct.accountId && accountId) {
      // Only prevent if product is already in the SAME account
      if (existingProduct.accountId.toString() === accountId.toString()) {
        const currentAccount = await Account.findById(accountId);
        return res.status(200).json({ 
          alreadyExists: true,
          message: `Product already exists in this account: ${currentAccount?.name || 'Current Account'}`,
          product: existingProduct
        });
      }
    }
    
    if (accountId) {
      const accountExists = await Account.findById(accountId);
      if (!accountExists) {
        return res.status(404).json({ error: "Account not found" });
      }
    }
    
    const product = await Product.findOneAndUpdate(
      { asin: asin.toUpperCase() },
      { accountId: accountId || null },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    console.log(`✅ Product ${asin} assigned to account ${accountId}`);
    res.json(product);
  } catch (err) {
    console.error("Error assigning product:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============ End Account Management APIs ============

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "ASIN lookup API running",
    status: "active",
    timestamp: new Date().toISOString()
  });
});

// Generate AI content for a product
app.post("/generate-ebay/:asin", async (req, res) => {
  const { asin } = req.params;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: "OpenAI API key not configured" });
    }

    let product = await getProductFromDB(asin);
    if (!product) {
      return res.status(404).json({ error: "Product not found. Fetch the product first." });
    }

    console.log(`🤖 Generating eBay content for: ${asin}`);
    const ebayData = await generateEbayContent(product);
    
    product.ebay = ebayData;
    await saveProductToDB(product);
    
    console.log(`✅ eBay content generated for: ${asin}`);
    res.json({ success: true, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
async function startServer() {
  await connectDB();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
  });
}

startServer();