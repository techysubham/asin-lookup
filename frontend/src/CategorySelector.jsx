import { useState, useEffect } from 'react';
import './CategorySelector.css';

export default function CategorySelector({ 
  accountId, 
  selectedCategory, 
  onSelectCategory,
  apiBase 
}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [error, setError] = useState('');

  // Fetch categories when account changes
  useEffect(() => {
    if (accountId) {
      fetchCategories();
    } else {
      setCategories([]);
    }
  }, [accountId]);

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/accounts/${accountId}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      } else {
        throw new Error('Failed to fetch categories');
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDesc.trim(),
          accountId
        })
      });

      if (res.ok) {
        const newCategory = await res.json();
        setCategories([...categories, newCategory]);
        setNewCategoryName('');
        setNewCategoryDesc('');
        setShowAddForm(false);
        onSelectCategory(newCategory);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create category');
      }
    } catch (err) {
      console.error('Failed to add category:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Are you sure you want to delete this category? Products will not be deleted.')) {
      return;
    }

    try {
      const res = await fetch(`${apiBase}/categories/${categoryId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setCategories(categories.filter(c => c._id !== categoryId));
        if (selectedCategory?._id === categoryId) {
          onSelectCategory(null);
        }
      } else {
        throw new Error('Failed to delete category');
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert(err.message);
    }
  };

  const handleCategoryUpdate = (updatedCategory) => {
    // Update the category in the list
    setCategories(categories.map(c => c._id === updatedCategory._id ? updatedCategory : c));
    // Update selected category if it's the one that was updated
    if (selectedCategory?._id === updatedCategory._id) {
      onSelectCategory(updatedCategory);
    }
  };

  if (!accountId) {
    return (
      <div className="category-selector">
        <p className="info-message">Please select an account first</p>
      </div>
    );
  }

  return (
    <div className="category-selector">
      <div className="category-header">
        <h3>Product Categories</h3>
        <button 
          className="btn-add-category"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={loading}
        >
          {showAddForm ? '✕ Cancel' : '+ Add Category'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddForm && (
        <form className="add-category-form" onSubmit={handleAddCategory}>
          <input
            type="text"
            placeholder="Category name (e.g., Watch Strap, Console)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            maxLength={50}
            required
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newCategoryDesc}
            onChange={(e) => setNewCategoryDesc(e.target.value)}
            maxLength={200}
          />
          <button type="submit" disabled={loading || !newCategoryName.trim()}>
            {loading ? 'Creating...' : 'Create Category'}
          </button>
        </form>
      )}

      {loading && categories.length === 0 ? (
        <p className="loading-message">Loading categories...</p>
      ) : categories.length === 0 ? (
        <p className="info-message">No categories yet. Create your first category to organize products.</p>
      ) : (
        <div className="category-list">
          {categories.map((category) => (
            <div 
              key={category._id}
              className={`category-card ${selectedCategory?._id === category._id ? 'selected' : ''}`}
              onClick={() => onSelectCategory(category)}
            >
              <div className="category-info">
                <h4>{category.name}</h4>
                {category.description && <p>{category.description}</p>}
              </div>
              <button
                className="btn-delete-category"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCategory(category._id);
                }}
                title="Delete category"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedCategory && (
        <div className="selected-category-info">
          <strong>Selected:</strong> {selectedCategory.name}
        </div>
      )}
    </div>
  );
}
