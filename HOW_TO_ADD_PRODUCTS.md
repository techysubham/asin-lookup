# How to Add Products to Accounts

## Method 1: Using the ASIN Lookup View (NEW!)

This is the easiest way:

1. **Switch to ASIN Lookup View** (if not already there)
   - Click the "📦 ASIN Lookup" button at the top

2. **Look up products** by entering ASINs
   - Enter one or more ASINs (comma or newline separated)
   - Click "🔍 Lookup"

3. **Assign products to accounts**
   - In the results table, find the "Assign to Account..." dropdown in the Actions column
   - Select an account from the dropdown
   - The product is immediately assigned!

## Method 2: Using the Manage Products View

1. **Create an account first** (if you haven't already)
   - Click "📊 Manage Products" at the top
   - Click "+ Add New Account"
   - Fill in name and email (required)
   - Click "Create Account"

2. **Look up products in ASIN Lookup view**
   - Switch to ASIN Lookup view
   - Look up your products

3. **Assign them using the dropdown**
   - Use the dropdown in the Actions column as described above

4. **View assigned products**
   - Switch back to "Manage Products" view
   - Select your account from the dropdown
   - See all products assigned to that account

## Method 3: Using the API

For programmatic access:

```bash
# Assign a product to an account
curl -X POST http://localhost:8000/products/B0CGV192GK/assign \
  -H "Content-Type: application/json" \
  -d '{"accountId": "your_account_id_here"}'

# Unassign a product (set accountId to null)
curl -X POST http://localhost:8000/products/B0CGV192GK/assign \
  -H "Content-Type: application/json" \
  -d '{"accountId": null}'
```

## Workflow Example

**Scenario:** You want to organize products for your Amazon store

1. **Create Account**
   - Go to Manage Products view
   - Add account: "My Amazon Store" with email "store@example.com"

2. **Add Products**
   - Go to ASIN Lookup view
   - Enter ASINs: `B0CGV192GK, B08N5WRWNW, B07XYZ1234`
   - Click Lookup

3. **Assign Products**
   - For each product in results, use "Assign to Account..." dropdown
   - Select "My Amazon Store"
   - Products are now linked to your account

4. **Manage Products**
   - Go to Manage Products view
   - Select "My Amazon Store" from dropdown
   - Edit product details (title, price, brand, description)
   - Changes save automatically

## Tips

- ✅ Create accounts **before** looking up products for better organization
- ✅ You can reassign products to different accounts anytime
- ✅ Products can belong to only **one account** at a time
- ✅ Use the "Manage Products" view to bulk edit products for an account
- ✅ The assignment dropdown shows in the ASIN lookup results immediately after loading accounts
