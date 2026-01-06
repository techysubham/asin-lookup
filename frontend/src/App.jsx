import { useState } from "react";
import "./App.css";

export default function App() {
  const [asins, setAsins] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

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

  // Export products to CSV
  const exportToCSV = () => {
    if (products.length === 0) return;

    // Define CSV headers
    const headers = [
      'ASIN',
      'Title',
      'Brand',
      'Price',
      'Rating',
      'Review Count',
      'Description',
      'Image URL',
      'Source',
      'Last Updated'
    ];

    // Convert products to CSV rows
    const rows = products.map(product => [
      product.asin,
      `"${(product.title || '').replace(/"/g, '""')}"`, // Escape quotes
      `"${(product.brand || '').replace(/"/g, '""')}"`,
      product.price || '',
      product.rating || '',
      product.reviewCount || 0,
      `"${(product.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      product.images?.[0] || '',
      product.source || '',
      product.last_updated || ''
    ]);

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
      <h1>🛍️ Amazon ASIN Lookup</h1>
      <div className="search-box">
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
                  <th>eBay Image</th>
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
                    <td className="image-cell">
                      {product.ebay?.image ? (
                        <img src={product.ebay.image} alt={product.ebay.title || 'eBay'} className="product-thumbnail" />
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
    </div>
  );
}