const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  asin: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9]{10}$/.test(v);
      },
      message: 'ASIN must be exactly 10 alphanumeric characters'
    }
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  images: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.every(url => /^https?:\/\/.+/.test(url));
      },
      message: 'All images must be valid URLs'
    }
  },
  brand: {
    type: String,
    required: true,
    trim: true,
    default: 'Unbranded'
  },
  price: {
    type: String,
    required: true,
    default: 'Price not available'
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: null
  },
  reviewCount: {
    type: Number,
    min: 0,
    default: 0
  },
  source: {
    type: String,
    required: true,
    enum: ['amazon-helper', 'manual', 'api'],
    default: 'amazon-helper'
  },
  // eBay data fields
  ebay: {
    title: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    },
    imageLinks: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    price: {
      type: String,
      default: ''
    },
    itemId: {
      type: String,
      default: ''
    }
  },
  // Account association
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    default: null,
    index: true
  },
  // Category association
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
    index: true
  },
  // Template values (key-value pairs matching category's templateColumns)
  templateValues: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  // Product-specific spreadsheet template
  spreadsheet: {
    columns: {
      type: [{
        id: String,
        name: String,
        type: String,
        width: Number
      }],
      default: function() {
        // Initialize with 10 default columns (A-J)
        return Array.from({ length: 10 }, (_, i) => ({
          id: `col_${i + 1}`,
          name: String.fromCharCode(65 + i), // A, B, C, etc.
          type: 'text',
          width: 150
        }));
      }
    },
    rows: {
      type: [{
        id: String,
        cells: {
          type: Map,
          of: String
        }
      }],
      default: function() {
        // Initialize with 10 default rows
        const cols = Array.from({ length: 10 }, (_, i) => `col_${i + 1}`);
        return Array.from({ length: 10 }, (_, i) => ({
          id: `row_${i + 1}`,
          cells: new Map(cols.map(colId => [colId, '']))
        }));
      }
    }
  },
  last_updated: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'products'
});

// Indexes for better query performance
productSchema.index({ asin: 1, last_updated: -1 });
productSchema.index({ brand: 1 });
productSchema.index({ rating: -1 });

// Virtual field to check if data is stale
productSchema.virtual('isStale').get(function() {
  const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 2592000; // 30 days in seconds
  const now = new Date().getTime();
  const updated = new Date(this.last_updated).getTime();
  return (now - updated) > (CACHE_TTL * 1000);
});

// Method to update product data
productSchema.methods.updateData = function(productData) {
  Object.assign(this, productData);
  this.last_updated = new Date();
  return this.save();
};

// Static method to find or create product
productSchema.statics.findByAsin = function(asin) {
  return this.findOne({ asin: asin.toUpperCase() });
};

// Static method to upsert product
productSchema.statics.upsertProduct = function(productData) {
  const updateData = { ...productData, last_updated: new Date() };
  return this.findOneAndUpdate(
    { asin: productData.asin.toUpperCase() },
    updateData,
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
};

// Ensure virtuals are included when converting to JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
