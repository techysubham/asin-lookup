const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const { connectDB, getProductFromDB, saveProductToDB, Product } = require("./db");
const Account = require("./models/Account");
const Category = require("./models/Category");
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

// ============ Category Template Management APIs ============

// Add column to category template
app.post("/categories/:categoryId/template/column", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { columnName, columnType } = req.body;
    
    if (!columnName) {
      return res.status(400).json({ error: "Column name is required" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Generate unique column ID
    const columnId = `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add new column
    const newColumn = {
      columnId,
      columnName,
      columnType: columnType || 'text',
      order: category.templateColumns.length
    };

    category.templateColumns.push(newColumn);
    await category.save();

    console.log(`✅ Column added to category ${categoryId}: ${columnName}`);
    res.json(category);
  } catch (err) {
    console.error("Error adding column:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update column in category template
app.put("/categories/:categoryId/template/column/:columnId", async (req, res) => {
  try {
    const { categoryId, columnId } = req.params;
    const { columnName, columnType } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const column = category.templateColumns.find(col => col.columnId === columnId);
    if (!column) {
      return res.status(404).json({ error: "Column not found" });
    }

    // Update column properties
    if (columnName !== undefined) column.columnName = columnName;
    if (columnType !== undefined) column.columnType = columnType;

    await category.save();

    console.log(`✅ Column updated in category ${categoryId}: ${columnId}`);
    res.json(category);
  } catch (err) {
    console.error("Error updating column:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete column from category template
app.delete("/categories/:categoryId/template/column/:columnId", async (req, res) => {
  try {
    const { categoryId, columnId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const initialLength = category.templateColumns.length;
    category.templateColumns = category.templateColumns.filter(col => col.columnId !== columnId);

    if (category.templateColumns.length === initialLength) {
      return res.status(404).json({ error: "Column not found" });
    }

    await category.save();

    // Also remove this column's values from all products in this category
    await Product.updateMany(
      { categoryId },
      { $unset: { [`templateValues.${columnId}`]: "" } }
    );

    console.log(`✅ Column deleted from category ${categoryId}: ${columnId}`);
    res.json(category);
  } catch (err) {
    console.error("Error deleting column:", err);
    res.status(500).json({ error: err.message });
  }
});

// Reorder columns in category template
app.put("/categories/:categoryId/template/reorder", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { columnOrder } = req.body; // Array of columnIds in desired order

    if (!Array.isArray(columnOrder)) {
      return res.status(400).json({ error: "columnOrder must be an array" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Update order property for each column
    columnOrder.forEach((columnId, index) => {
      const column = category.templateColumns.find(col => col.columnId === columnId);
      if (column) {
        column.order = index;
      }
    });

    // Sort template by order
    category.templateColumns.sort((a, b) => a.order - b.order);
    await category.save();

    console.log(`✅ Columns reordered in category ${categoryId}`);
    res.json(category);
  } catch (err) {
    console.error("Error reordering columns:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update product template value
app.put("/products/:asin/template/:columnId", async (req, res) => {
  try {
    const { asin, columnId } = req.params;
    const { value } = req.body;

    const product = await Product.findOne({ asin: asin.toUpperCase() });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Update the template value
    product.templateValues.set(columnId, value);
    product.last_updated = new Date();
    product.markModified('templateValues');
    await product.save();

    console.log(`✅ Template value updated for product ${asin}, column ${columnId}`);
    res.json(product);
  } catch (err) {
    console.error("Error updating template value:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============ End Category Template Management APIs ============

// Assign product to account
app.post("/products/:asin/assign", async (req, res) => {
  try {
    const { asin } = req.params;
    const { accountId, categoryId } = req.body;
    
    console.log(`📌 Assigning product ${asin} to account: ${accountId}, category: ${categoryId}`);
    
    // Check if product exists
    const existingProduct = await Product.findOne({ asin: asin.toUpperCase() });
    
    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    // Check if trying to assign to a different account
    if (existingProduct.accountId && accountId && 
        existingProduct.accountId.toString() !== accountId.toString()) {
      return res.status(400).json({ 
        error: "Product already assigned to a different account"
      });
    }
    
    if (accountId) {
      const accountExists = await Account.findById(accountId);
      if (!accountExists) {
        return res.status(404).json({ error: "Account not found" });
      }
    }

    if (categoryId) {
      const categoryExists = await Category.findById(categoryId);
      if (!categoryExists) {
        return res.status(404).json({ error: "Category not found" });
      }
    }
    
    // Update both accountId and categoryId
    const updateData = { accountId: accountId || null };
    if (categoryId) {
      updateData.categoryId = categoryId;
    }
    
    const product = await Product.findOneAndUpdate(
      { asin: asin.toUpperCase() },
      updateData,
      { new: true }
    );
    
    console.log(`✅ Product ${asin} assigned to account ${accountId} and category ${categoryId}`);
    res.json(product);
  } catch (err) {
    console.error("Error assigning product:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============ End Account Management APIs ============

// ============ Category Management APIs ============

// Get all categories for an account
app.get("/accounts/:accountId/categories", async (req, res) => {
  try {
    const { accountId } = req.params;
    const categories = await Category.find({ accountId, status: 'active' }).sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: err.message });
  }
});

// Create new category
app.post("/categories", async (req, res) => {
  try {
    const { name, accountId, description } = req.body;
    
    if (!name || !accountId) {
      return res.status(400).json({ error: "Name and accountId are required" });
    }

    // Check if account exists
    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Check if category with same name exists for this account
    const existingCategory = await Category.findOne({ name, accountId });
    if (existingCategory) {
      return res.status(409).json({ 
        error: "Category with this name already exists for this account" 
      });
    }

    const category = new Category({
      name,
      accountId,
      description: description || ''
    });

    await category.save();
    console.log(`✅ New category created: ${name} for account ${accountId}`);
    res.status(201).json(category);
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update category
app.put("/categories/:id", async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, description, status },
      { new: true, runValidators: true }
    );
    
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    console.log(`✅ Category updated: ${category.name}`);
    res.json(category);
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete category
app.delete("/categories/:id", async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    // Optionally unlink products from this category
    await Product.updateMany(
      { categoryId: req.params.id },
      { $set: { categoryId: null } }
    );
    
    console.log(`✅ Category deleted: ${category.name}`);
    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get products by category ID
app.get("/categories/:id/products", async (req, res) => {
  try {
    console.log(`🔍 Fetching products for category: ${req.params.id}`);
    const products = await Product.find({ categoryId: req.params.id })
      .sort({ last_updated: -1 });
    console.log(`✅ Found ${products.length} products for category ${req.params.id}`);
    if (products.length > 0) {
      console.log(`📦 Sample product:`, { asin: products[0].asin, categoryId: products[0].categoryId });
    }
    res.json(products);
  } catch (err) {
    console.error("Error fetching category products:", err);
    res.status(500).json({ error: err.message });
  }
});

// Debug: Get all products to check categoryId
app.get("/debug/all-products", async (req, res) => {
  try {
    const products = await Product.find({}).select('asin title categoryId accountId');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ End Category Management APIs ============

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

// ==================== TEMPLATE SPREADSHEET ENDPOINTS ====================

// Get spreadsheet data for a specific product
app.get('/products/:asin/spreadsheet', async (req, res) => {
  try {
    const { asin } = req.params;
    const product = await Product.findOne({ asin: asin.toUpperCase() });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Return product's spreadsheet data (already initialized with defaults)
    const spreadsheetData = {
      columns: product.spreadsheet?.columns || [],
      rows: product.spreadsheet?.rows || []
    };

    res.json(spreadsheetData);
  } catch (err) {
    console.error('Error fetching product spreadsheet:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save spreadsheet data for a specific product
app.put('/products/:asin/spreadsheet', async (req, res) => {
  try {
    const { asin } = req.params;
    const { columns, rows } = req.body;

    const product = await Product.findOneAndUpdate(
      { asin: asin.toUpperCase() },
      {
        'spreadsheet.columns': columns,
        'spreadsheet.rows': rows
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (err) {
    console.error('Error saving template:', err);
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