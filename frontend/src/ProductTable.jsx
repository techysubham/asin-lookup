import { useState, useEffect } from 'react';
import './ProductTable.css';

export default function ProductTable({ accountId, category, onProductUpdate, onOpenTemplate, apiBase }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    asin: '',
    title: '',
    brand: '',
    price: '',
    description: ''
  });
  const [customColumns, setCustomColumns] = useState([]);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumn, setNewColumn] = useState({ name: '', label: '', type: 'text' });
  const [unassignedProducts, setUnassignedProducts] = useState([]);
  const [selectedProductForTemplate, setSelectedProductForTemplate] = useState(null);

  const categoryId = category?._id;
  const templateColumns = category?.templateColumns || [];

  useEffect(() => {
    if (accountId && categoryId) {
      fetchProducts();
    } else {
      setProducts([]);
    }
  }, [accountId, categoryId]);

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    setUnassignedProducts([]);
    try {
      // Fetch products by category
      let res = await fetch(`${apiBase}/categories/${categoryId}/products`);
      if (!res.ok) throw new Error('Failed to fetch products');
      let data = await res.json();
      
      // Always check for unassigned products in the account
      if (accountId) {
        res = await fetch(`${apiBase}/accounts/${accountId}/products`);
        if (res.ok) {
          const accountProducts = await res.json();
          const unassigned = accountProducts.filter(p => !p.categoryId);
          if (unassigned.length > 0) {
            setUnassignedProducts(unassigned);
          }
        }
      }
      
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (asin, field, currentValue) => {
    setEditingCell({ asin, field });
    setEditValue(currentValue || '');
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async (asin, field) => {
    try {
      let res;
      // Check if this is a template field
      if (field.startsWith('template_')) {
        const columnId = field.replace('template_', '');
        res = await fetch(`${apiBase}/products/${asin}/template/${columnId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: editValue })
        });
      } else {
        // Regular field update
        const updateData = { [field]: editValue };
        res = await fetch(`${apiBase}/products/${asin}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
      }

      if (!res.ok) throw new Error('Failed to update product');
      
      const updatedProduct = await res.json();
      setProducts(products.map(p => p.asin === asin ? updatedProduct : p));
      setEditingCell(null);
      setEditValue('');
      
      if (onProductUpdate) {
        onProductUpdate(updatedProduct);
      }
    } catch (err) {
      alert(`Error updating product: ${err.message}`);
    }
  };

  const handleKeyDown = (e, asin, field) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit(asin, field);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...newProduct,
        accountId,
        source: 'manual',
        rating: null,
        reviewCount: 0,
        images: []
      };

      const res = await fetch(`${apiBase}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asins: [newProduct.asin] })
      });

      if (!res.ok) throw new Error('Failed to add product');

      await fetch(`${apiBase}/products/${newProduct.asin}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });

      await fetch(`${apiBase}/products/${newProduct.asin}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });

      setNewProduct({ asin: '', title: '', brand: '', price: '', description: '' });
      setShowAddProduct(false);
      fetchProducts();
    } catch (err) {
      alert(`Error adding product: ${err.message}`);
    }
  };

  const handleAddColumn = () => {
    if (newColumn.name && newColumn.label) {
      setCustomColumns([...customColumns, { ...newColumn, id: Date.now() }]);
      setNewColumn({ name: '', label: '', type: 'text' });
      setShowAddColumn(false);
    }
  };

  const deleteCustomColumn = (columnId) => {
    if (confirm('Are you sure you want to delete this column?')) {
      setCustomColumns(customColumns.filter(col => col.id !== columnId));
    }
  };

  const assignProductToCategory = async (asin) => {
    try {
      console.log('Assigning product:', asin, 'to category:', categoryId);
      const res = await fetch(`${apiBase}/products/${asin}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: accountId,
          categoryId: categoryId
        })
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to assign product');
      }
      
      const result = await res.json();
      console.log('Assignment result:', result);
      
      // Refresh products list
      await fetchProducts();
      alert(`✅ Product ${asin} assigned to category successfully!`);
    } catch (err) {
      console.error('Assignment error:', err);
      alert(`Error assigning product: ${err.message}`);
    }
  };

  const deleteProduct = async (asin) => {
    if (!confirm(`Are you sure you want to remove product ${asin} from this category?`)) return;
    
    try {
      await fetch(`${apiBase}/products/${asin}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: null })
      });
      
      setProducts(products.filter(p => p.asin !== asin));
    } catch (err) {
      alert(`Error removing product: ${err.message}`);
    }
  };

  const renderCell = (product, field, displayValue) => {
    const isEditing = editingCell?.asin === product.asin && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="editing-cell">
          {field === 'description' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, product.asin, field)}
              autoFocus
              rows={3}
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, product.asin, field)}
              autoFocus
            />
          )}
          <div className="edit-actions">
            <button onClick={() => saveEdit(product.asin, field)} className="btn-save">
              ✓ Save
            </button>
            <button onClick={cancelEditing} className="btn-cancel-edit">
              ✕ Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div 
        className="editable-cell"
        onClick={() => startEditing(product.asin, field, displayValue)}
        title="Click to edit"
      >
        {displayValue || <span className="empty-value">—</span>}
      </div>
    );
  };

  if (!accountId) {
    return (
      <div className="product-table-container">
        <div className="no-selection">
          <p>👆 Please select an account to view products</p>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="product-table-container">
        <div className="no-selection">
          <p>👆 Please select a category to view products</p>
        </div>
      </div>
    );
  }

  return (
    <div className="product-table-container">
      <div className="table-header">
        <h3>Products ({products.length})</h3>
        <div className="table-actions">
          <button onClick={() => setShowAddProduct(!showAddProduct)} className="btn-add">
            {showAddProduct ? '✕ Cancel' : '+ Add Product'}
          </button>
          <button onClick={() => setShowAddColumn(!showAddColumn)} className="btn-add">
            {showAddColumn ? '✕ Cancel' : '+ Add Column'}
          </button>
          <button onClick={fetchProducts} className="btn-refresh">
            ↻ Refresh
          </button>
        </div>
      </div>

      {showAddProduct && (
        <div className="add-form">
          <h4>Add New Product</h4>
          <form onSubmit={handleAddProduct}>
            <div className="form-row">
              <input
                type="text"
                placeholder="ASIN (required)"
                value={newProduct.asin}
                onChange={(e) => setNewProduct({...newProduct, asin: e.target.value.toUpperCase()})}
                required
                maxLength={10}
              />
              <input
                type="text"
                placeholder="Title"
                value={newProduct.title}
                onChange={(e) => setNewProduct({...newProduct, title: e.target.value})}
              />
              <input
                type="text"
                placeholder="Brand"
                value={newProduct.brand}
                onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
              />
              <input
                type="text"
                placeholder="Price"
                value={newProduct.price}
                onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
              />
            </div>
            <textarea
              placeholder="Description"
              value={newProduct.description}
              onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
              rows={2}
            />
            <button type="submit" className="btn-submit-form">Add Product</button>
          </form>
        </div>
      )}

      {showAddColumn && (
        <div className="add-form">
          <h4>Add Custom Column</h4>
          <div className="form-row">
            <input
              type="text"
              placeholder="Column Name (e.g., supplier)"
              value={newColumn.name}
              onChange={(e) => setNewColumn({...newColumn, name: e.target.value})}
            />
            <input
              type="text"
              placeholder="Column Label (e.g., Supplier)"
              value={newColumn.label}
              onChange={(e) => setNewColumn({...newColumn, label: e.target.value})}
            />
            <select
              value={newColumn.type}
              onChange={(e) => setNewColumn({...newColumn, type: e.target.value})}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
            <button onClick={handleAddColumn} className="btn-submit-form">Add Column</button>
          </div>
        </div>
      )}

      {loading && <div className="loading">Loading products...</div>}
      
      {error && !unassignedProducts.length && (
        <div className="error-message">
          {error}
          <button onClick={fetchProducts} className="btn-retry">Retry</button>
        </div>
      )}

      {!loading && unassignedProducts.length > 0 && (
        <div className="unassigned-products">
          <h4>📦 Unassigned Products in Account</h4>
          <p>These products don't have a category. Assign them to "{category?.name}":</p>
          <div className="unassigned-list">
            {unassignedProducts.map((product) => (
              <div key={product.asin} className="unassigned-item">
                <div className="unassigned-info">
                  <img src={product.images?.[0]} alt={product.title} className="unassigned-thumb" />
                  <div>
                    <strong>{product.asin}</strong>
                    <p>{product.title}</p>
                  </div>
                </div>
                <button 
                  onClick={() => assignProductToCategory(product.asin)}
                  className="btn-assign"
                >
                  ➕ Assign to Category
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && products.length === 0 && unassignedProducts.length === 0 && (
        <div className="no-products">
          <p>No products found for this category.</p>
          <p className="hint">Click "+ Add Product" to add products manually or use ASIN Lookup to fetch from Amazon.</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="table-wrapper">
          <table className="product-table">
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
                <th>eBay Price</th>
                <th>Amazon Description</th>
                {templateColumns.sort((a, b) => a.order - b.order).map(col => (
                  <th key={col.columnId} className="template-column-header">{col.columnName}</th>
                ))}
                {customColumns.map(col => (
                  <th key={col.id} className="custom-column-header">
                    {col.label}
                    <button 
                      onClick={() => deleteCustomColumn(col.id)} 
                      className="btn-delete-column"
                      title="Delete column"
                    >
                      ✕
                    </button>
                  </th>
                ))}
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <>
                  <tr key={product.asin}>
                    <td className="asin-cell">{product.asin}</td>
                    <td className="image-cell">
                      {product.images && product.images.length > 0 && (
                        <img src={product.images[0]} alt={product.title} className="product-thumbnail" />
                      )}
                    </td>
                    <td className="title-cell">{renderCell(product, 'title', product.title)}</td>
                    <td>{renderCell(product, 'brand', product.brand)}</td>
                    <td className="rating-cell">
                      {product.rating ? (
                        <div className="rating-compact">
                          <strong>{product.rating.toFixed(1)}</strong> ⭐
                          <div className="review-count">({product.reviewCount?.toLocaleString() || 0})</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td>{renderCell(product, 'price', product.price)}</td>
                    <td className="title-cell">
                      {product.ebay?.title ? (
                        <div className="ai-content">
                          {renderCell(product, 'ebay.title', product.ebay.title)}
                          <span className="ai-badge">🤖 AI</span>
                        </div>
                      ) : <span className="no-data">Not generated</span>}
                    </td>
                    <td className="image-links-cell">
                      {renderCell(product, 'ebay.imageLinks', product.ebay?.imageLinks || '')}
                    </td>
                    <td className="description-cell">
                      {product.ebay?.description ? (
                        <div className="ai-content">
                          {renderCell(product, 'ebay.description', product.ebay.description)}
                          <span className="ai-badge">🤖 AI</span>
                        </div>
                      ) : <span className="no-data">Not generated</span>}
                    </td>
                    <td>{renderCell(product, 'ebay.price', product.ebay?.price || '')}</td>
                    <td className="description-cell">
                      {renderCell(product, 'description', product.description)}
                    </td>
                    {templateColumns.sort((a, b) => a.order - b.order).map(col => {
                      const templateValues = product.templateValues || {};
                      const value = templateValues[col.columnId] || '';
                      return (
                        <td key={col.columnId} className="template-column-cell">
                          {renderCell(product, `template_${col.columnId}`, value)}
                        </td>
                      );
                    })}
                    {customColumns.map(col => (
                      <td key={col.id} className="custom-column-cell">
                        <input
                          type={col.type}
                          placeholder={`Enter ${col.label}`}
                          className="inline-edit-input"
                        />
                      </td>
                    ))}
                    <td className="date-cell">
                      {new Date(product.last_updated).toLocaleDateString()}
                    </td>
                    <td className="actions-cell">
                      <button 
                        onClick={() => onOpenTemplate && onOpenTemplate(product)} 
                        className="btn-template"
                        title="Open template spreadsheet"
                      >
                        📋
                      </button>
                      <button 
                        onClick={() => deleteProduct(product.asin)} 
                        className="btn-delete"
                        title="Remove from category"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="table-footer">
          <p className="hint">💡 Click on any cell to edit. Press Enter to save, Escape to cancel.</p>
        </div>
      )}
    </div>
  );
}
