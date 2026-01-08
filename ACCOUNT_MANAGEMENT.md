# Account Management & Product Editing Feature

## Overview
This feature adds comprehensive account management and product editing capabilities to the ASIN Lookup application.

## Features Added

### 1. **Account Management**
- Create new accounts with name, email, description, and status
- View all accounts in a dropdown selector
- Associate products with specific accounts
- Track account status (active/inactive)

### 2. **Product Management**
- View all products for a selected account
- Inline editing of product fields:
  - Title
  - Brand
  - Price
  - Description
- Real-time updates to the database
- Easy keyboard navigation (Enter to save, Escape to cancel)

### 3. **Two-View Interface**
- **ASIN Lookup View**: Original functionality for looking up Amazon products
- **Manage Products View**: New interface for account and product management

## Backend Changes

### New Files
- `backend/models/Account.js` - Account schema and model

### Modified Files
- `backend/models/Product.js` - Added `accountId` field to link products with accounts
- `backend/index.js` - Added 8 new API endpoints:
  - `GET /accounts` - Get all accounts
  - `POST /accounts` - Create new account
  - `GET /accounts/:id` - Get account by ID
  - `PUT /accounts/:id` - Update account
  - `DELETE /accounts/:id` - Delete account
  - `GET /accounts/:id/products` - Get products for an account
  - `PUT /products/:asin` - Update product
  - `POST /products/:asin/assign` - Assign product to account

## Frontend Changes

### New Files
- `frontend/src/AccountSelector.jsx` - Account dropdown and add new account form
- `frontend/src/AccountSelector.css` - Styling for account selector
- `frontend/src/ProductTable.jsx` - Editable product table
- `frontend/src/ProductTable.css` - Styling for product table

### Modified Files
- `frontend/src/App.jsx` - Added view switcher and integrated new components
- `frontend/src/App.css` - Added styles for view switcher

## Usage

### Creating an Account
1. Switch to "Manage Products" view
2. Click "+ Add New Account"
3. Fill in account details (name and email are required)
4. Click "Create Account"

### Managing Products
1. Select an account from the dropdown
2. View all products associated with that account
3. Click on any cell to edit (title, brand, price, description)
4. Press Enter to save or Escape to cancel

### Assigning Products to Accounts
Products are automatically associated with accounts when looked up. You can also use the API endpoint to reassign products.

## API Examples

### Create Account
```bash
POST /accounts
Content-Type: application/json

{
  "name": "My Store",
  "email": "store@example.com",
  "description": "Main selling account",
  "status": "active"
}
```

### Update Product
```bash
PUT /products/B0CGV192GK
Content-Type: application/json

{
  "title": "Updated Product Title",
  "price": "$29.99",
  "brand": "Updated Brand"
}
```

### Get Products for Account
```bash
GET /accounts/:accountId/products
```

## Database Schema

### Account Collection
```javascript
{
  _id: ObjectId,
  name: String (required, unique),
  email: String (required, unique),
  description: String,
  status: 'active' | 'inactive',
  metadata: Map<String>,
  createdAt: Date,
  updatedAt: Date
}
```

### Product Collection (Updated)
```javascript
{
  // ... existing fields
  accountId: ObjectId (ref: 'Account'), // NEW FIELD
  // ... rest of fields
}
```

## Future Enhancements
- Bulk product assignment to accounts
- Product import/export per account
- Account-level analytics and reporting
- Multi-select for batch operations
- Product filtering and search
- Account permissions and user roles
