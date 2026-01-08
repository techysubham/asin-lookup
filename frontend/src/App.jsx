import { useState, useEffect } from "react";
import "./App.css";
import AccountSelector from "./AccountSelector";
import ProductTable from "./ProductTable";

export default function App() {
  const [asins, setAsins] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Account management state
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [view, setView] = useState('asin-lookup'); // 'asin-lookup' or 'manage-products'

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

  // Load accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  // Fetch all accounts
  const fetchAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/accounts`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setAccountsLoading(false);
    }
  };

  // Add new account
  const handleAddAccount = async (accountData) => {
    const res = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to create account');
    }

    const newAccount = await res.json();
    setAccounts([...accounts, newAccount]);
    setSelectedAccount(newAccount);
    return newAccount;
  };

  // Select account
  const handleSelectAccount = (account) => {
    setSelectedAccount(account);
  };

  // Handle product update from table
  const handleProductUpdate = (updatedProduct) => {
    console.log('Product updated:', updatedProduct);
  };

  // Assign product to account
  const assignProductToAccount = async (asin, accountId) => {
    try {
      const res = await fetch(`${API_BASE}/products/${asin}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Check if product already exists in the same account
        if (data.alreadyExists) {
          console.log(`Product ${asin} already exists in this account`);
          return { alreadyExists: true, asin, message: data.message };
        }
        
        // Successfully assigned
        setProducts(products.map(p => p.asin === asin ? data : p));
        return data;
      }

      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to assign product');
    } catch (err) {
      console.error("Assign error:", err);
      throw err;
    }
  };

  // Helper function to render stars
  const renderStars = (rating) => {
    if (!rating) return null;
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<span key={i} className="star filled">★</span>);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<span key={i} className="star half">★</span>);
      } else {
        stars.push(<span key={i} className="star empty">☆</span>);
      }
    }
    return stars;
  };

  async function lookupProducts() {
    if (!asins.trim()) return;
    
    setLoading(true);
    setError("");
    setProducts([]);

    try {
      // Check if online
      if (!navigator.onLine) {
        throw new Error("No internet connection. Please check your network and try again.");
      }

      // Parse ASINs from textarea (comma or newline separated)
      const asinList = asins
        .split(/[,\n]+/)
        .map(a => a.trim().toUpperCase())
        .filter(a => a.length > 0);
      
      if (asinList.length === 0) {
        throw new Error("Please enter at least one valid ASIN");
      }

      // If single ASIN, use the single product endpoint
      if (asinList.length === 1) {
        const res = await fetch(`${API_BASE}/product/${asinList[0]}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `Product not found (HTTP ${res.status})`);
        }
        const data = await res.json();
        
        // Auto-assign to selected account
        if (selectedAccount) {
          const assignResult = await assignProductToAccount(data.asin, selectedAccount._id);
          if (assignResult.alreadyExists) {
            setError(`ℹ️ ${data.asin} already exists in this account`);
          }
        }
        
        setProducts([data]);
      } else {
        // Multiple ASINs, use the batch endpoint
        const res = await fetch(`${API_BASE}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asins: asinList })
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `Request failed (HTTP ${res.status})`);
        }
        const data = await res.json();
        
        // Auto-assign all to selected account
        const alreadyExists = [];
        if (selectedAccount) {
          for (const product of data) {
            const assignResult = await assignProductToAccount(product.asin, selectedAccount._id);
            if (assignResult.alreadyExists) {
              alreadyExists.push(product.asin);
            }
          }
        }
        
        if (alreadyExists.length > 0) {
          setError(`ℹ️ Already exist in this account: ${alreadyExists.join(', ')}`);
        }
        
        setProducts(data);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      const errorMsg = err.message || "Failed to fetch product data";
      if (errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
        setError("⚠️ Backend server is not responding. Please deploy the backend first or try again later.");
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey) lookupProducts();
  };

  // Regenerate eBay content for a specific product
  const regenerateEbayContent = async (asin) => {
    try {
      const res = await fetch(`${API_BASE}/product/${asin}?regenerate=true`);
      if (!res.ok) throw new Error("Failed to regenerate");
      const updatedProduct = await res.json();
      
      // Update the product in the state
      setProducts(products.map(p => p.asin === asin ? updatedProduct : p));
    } catch (err) {
      console.error("Regenerate error:", err);
      alert("Failed to regenerate eBay content. Please try again.");
    }
  };

  // Export products to CSV
  const exportToCSV = () => {
    if (products.length === 0) return;

    // Define CSV headers
    const headers = [
      'ASIN',
      'Amazon Images',
      'Amazon Title',
      'Brand',
      'Rating',
      'Amazon Price',
      'eBay Title (AI)',
      'eBay Image Links',
      'eBay Description (AI)',
      'Amazon Description',
      'Source',
      'Last Updated'
    ];

    // Convert products to CSV rows
    const rows = products.map(product => {
      // Join all Amazon images with /
      const amazonImages = (product.images || []).join(' / ');
      
      return [
        product.asin,
        `"${amazonImages}"`,
        `"${(product.title || '').replace(/"/g, '""')}"`, // Escape quotes
        `"${(product.brand || '').replace(/"/g, '""')}"`,
        product.rating || '',
        product.price || '',
        `"${(product.ebay?.title || '').replace(/"/g, '""')}"`,
        `"${(product.ebay?.imageLinks || '').replace(/"/g, '""')}"`,
        `"${(product.ebay?.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(product.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        product.source || '',
        product.last_updated || ''
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `asin-lookup-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1>🛍️ Amazon ASIN Lookup & Product Manager</h1>
      </header>

      {/* Account Selector - Always visible at top */}
      <AccountSelector
        accounts={accounts}
        selectedAccount={selectedAccount}
        onSelectAccount={handleSelectAccount}
        onAddAccount={handleAddAccount}
      />

      {/* Show content only if account is selected */}
      {selectedAccount ? (
        <>
          {/* View Switcher */}
          <div className="view-switcher">
            <button 
              className={`view-btn ${view === 'asin-lookup' ? 'active' : ''}`}
              onClick={() => setView('asin-lookup')}
            >
              🔍 ASIN Lookup
            </button>
            <button 
              className={`view-btn ${view === 'manage-products' ? 'active' : ''}`}
              onClick={() => setView('manage-products')}
            >
              📊 Manage Products
            </button>
          </div>

          {/* ASIN Lookup View */}
          {view === 'asin-lookup' && (
            <>          <div className="search-box">
            <textarea
              value={asins}
              onChange={(e) => setAsins(e.target.value.toUpperCase())}
              placeholder="Enter ASIN(s) - comma or newline separated&#10;e.g., B0CGV192GK, B08N5WRWNW&#10;or one per line"
              onKeyPress={handleKeyPress}
              disabled={loading}
              rows={3}
            />
            <button onClick={lookupProducts} disabled={!asins.trim() || loading}>
              {loading ? "🔄 Loading..." : "🔍 Lookup"}
            </button>
          </div>
          <p className="hint">💡 Enter one or more ASINs (comma or newline separated). Press Ctrl+Enter to search.</p>

          {error && <div className="error">❌ {error}</div>}

          {products.length > 0 && (
            <div className="results">
              <div className="results-header-row">
            <h2 className="results-header">📦 Found {products.length} Product{products.length > 1 ? 's' : ''}</h2>
            <button className="btn-export" onClick={exportToCSV}>
              📥 Export to CSV
            </button>
          </div>
          
          <div className="table-container">
            <table className="products-table">
              <thead>
                <tr>
                  <th>ASIN</th>
                  <th>Amazon Image</th>
                  <th>Amazon Title</th>
                  <th>Brand</th>
                  <th>Rating</th>
                  <th>Amazon Price</th>
                  <th>eBay Title (AI)</th>
                  <th>eBay Image Links</th>
                  <th>eBay Description (AI)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, idx) => (
                  <tr key={idx}>
                    <td className="asin-cell">
                      <span className="asin-badge">{product.asin}</span>
                    </td>
                    <td className="image-cell">
                      {product.images && product.images.length > 0 && (
                        <img src={product.images[0]} alt={product.title} className="product-thumbnail" />
                      )}
                    </td>
                    <td className="title-cell">
                      <div className="product-title">{product.title}</div>
                      {product.description && (
                        <details className="description-toggle">
                          <summary>Amazon Description</summary>
                          <p className="description">{product.description}</p>
                        </details>
                      )}
                    </td>
                    <td className="brand-cell">{product.brand}</td>
                    <td className="rating-cell">
                      {product.rating ? (
                        <div className="rating-compact">
                          <div className="stars-compact">
                            {renderStars(product.rating)}
                          </div>
                          <div className="rating-info">
                            <strong>{product.rating.toFixed(1)}</strong>
                            <span className="review-count">({product.reviewCount.toLocaleString()})</span>
                          </div>
                        </div>
                      ) : (
                        <span className="no-rating">N/A</span>
                      )}
                    </td>
                    <td className="price-cell">
                      <strong>{product.price}</strong>
                    </td>
                    <td className="title-cell">
                      {product.ebay?.title ? (
                        <div className="product-title ai-generated">
                          {product.ebay.title}
                          <span className="ai-badge">🤖 AI</span>
                        </div>
                      ) : (
                        <span className="no-data">Not generated</span>
                      )}
                    </td>
                    <td className="image-links-cell">
                      {product.ebay?.imageLinks ? (
                        <div className="image-links">
                          {product.ebay.imageLinks}
                        </div>
                      ) : (
                        <span className="no-data">-</span>
                      )}
                    </td>
                    <td className="description-cell">
                      {product.ebay?.description ? (
                        <div className="ebay-description ai-generated">
                          {product.ebay.description}
                          <span className="ai-badge">🤖 AI</span>
                        </div>
                      ) : (
                        <span className="no-data">Not generated</span>
                      )}
                    </td>
                    <td className="price-cell">
                      {product.ebay?.price ? (
                        <strong>{product.ebay.price}</strong>
                      ) : (
                        <span className="no-data">-</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button className="btn-small" onClick={() => window.open(`https://amazon.com/dp/${product.asin}`, '_blank')}>
                        Amazon
                      </button>
                      <button className="btn-small btn-regenerate" onClick={() => regenerateEbayContent(product.asin)} title="Regenerate eBay content">
                        🔄 Regen
                      </button>
                      {product.ebay?.itemId && (
                        <button className="btn-small btn-ebay" onClick={() => window.open(`https://www.ebay.com/itm/${product.ebay.itemId}`, '_blank')}>
                          eBay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

          {/* Manage Products View */}
          {view === 'manage-products' && (
            <ProductTable
              accountId={selectedAccount?._id}
              onProductUpdate={handleProductUpdate}
              apiBase={API_BASE}
            />
          )}
        </>
      ) : (
        <div className="no-account-selected">
          <div className="empty-state">
            <h2>👆 Please Select an Account</h2>
            <p>Choose an existing account from the dropdown above or create a new one to get started.</p>
          </div>
        </div>
      )}
    </div>
  );
}