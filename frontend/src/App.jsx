import { useState } from "react";
import "./App.css";

export default function App() {
  const [asins, setAsins] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_BASE = "http://localhost:8000";

  async function lookupProducts() {
    if (!asins.trim()) return;
    
    setLoading(true);
    setError("");
    setProducts([]);

    try {
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
        if (!res.ok) throw new Error(`Product not found (HTTP ${res.status})`);
        const data = await res.json();
        setProducts([data]);
      } else {
        // Multiple ASINs, use the batch endpoint
        const res = await fetch(`${API_BASE}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asins: asinList })
        });
        if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey) lookupProducts();
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
          <h2 className="results-header">📦 Found {products.length} Product{products.length > 1 ? 's' : ''}</h2>
          <div className="products-grid">
            {products.map((product, idx) => (
              <div key={idx} className="product">
                <div className="product-header">
                  <span className="asin-badge">{product.asin}</span>
                  <span className="source">📦 {product.source}</span>
                </div>
                
                <h3>{product.title}</h3>
                <p className="brand">🏷️ <strong>{product.brand}</strong></p>
                <p className="price">💰 {product.price}</p>
                
                {product.images && product.images.length > 0 && (
                  <div className="images">
                    {product.images.slice(0, 3).map((img, i) => (
                      <img key={i} src={img} alt={`Product ${i + 1}`} />
                    ))}
                  </div>
                )}

                {product.description && (
                  <details className="description-toggle">
                    <summary>View Description</summary>
                    <p className="description">{product.description}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}