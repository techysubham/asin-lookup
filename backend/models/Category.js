const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  // Template column definitions (shared by all products in this category)
  templateColumns: {
    type: [{
      columnId: {
        type: String,
        required: true
      },
      columnName: {
        type: String,
        required: true
      },
      columnType: {
        type: String,
        enum: ['text', 'number', 'date', 'url', 'textarea'],
        default: 'text'
      },
      order: {
        type: Number,
        default: 0
      }
    }],
    default: []
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  },
  // Template Spreadsheet data (separate from templateColumns)
  templateSpreadsheetColumns: {
    type: [{
      id: String,
      name: String,
      type: String,
      width: Number
    }],
    default: []
  },
  templateSpreadsheetRows: {
    type: [{
      id: String,
      cells: {
        type: Map,
        of: String
      }
    }],
    default: []
  }
}, {
  timestamps: true,
  collection: 'categories'
});

// Compound index to ensure unique category names per account
categorySchema.index({ name: 1, accountId: 1 }, { unique: true });

// Index for status
categorySchema.index({ status: 1 });

// Static method to find categories by account
categorySchema.statics.findByAccount = function(accountId) {
  return this.find({ accountId, status: 'active' }).sort({ name: 1 });
};

// Static method to find by name and account
categorySchema.statics.findByNameAndAccount = function(name, accountId) {
  return this.findOne({ name, accountId });
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
