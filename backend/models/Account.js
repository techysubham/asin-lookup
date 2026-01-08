const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true,
  collection: 'accounts'
});

// Indexes
accountSchema.index({ name: 1 });
accountSchema.index({ email: 1 });
accountSchema.index({ status: 1 });

// Static method to find active accounts
accountSchema.statics.findActive = function() {
  return this.find({ status: 'active' }).sort({ name: 1 });
};

// Static method to find by name
accountSchema.statics.findByName = function(name) {
  return this.findOne({ name });
};

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
