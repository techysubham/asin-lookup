import { useState } from 'react';
import './CategoryTemplateManager.css';

export default function CategoryTemplateManager({ category, apiBase, onUpdate }) {
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumn, setNewColumn] = useState({ name: '', type: 'text' });
  const [loading, setLoading] = useState(false);

  const columnTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'url', label: 'URL' },
    { value: 'textarea', label: 'Long Text' }
  ];

  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumn.name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/categories/${category._id}/template/column`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnName: newColumn.name.trim(),
          columnType: newColumn.type
        })
      });

      if (!res.ok) throw new Error('Failed to add column');
      
      const updatedCategory = await res.json();
      onUpdate(updatedCategory);
      
      setNewColumn({ name: '', type: 'text' });
      setShowAddColumn(false);
    } catch (err) {
      console.error('Error adding column:', err);
      alert('Failed to add column: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteColumn = async (columnId) => {
    if (!confirm('Delete this column? This will remove the column and all its data from all products in this category.')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/categories/${category._id}/template/column/${columnId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete column');
      
      const updatedCategory = await res.json();
      onUpdate(updatedCategory);
    } catch (err) {
      console.error('Error deleting column:', err);
      alert('Failed to delete column: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const templateColumns = category.templateColumns || [];

  return (
    <div className="category-template-manager">
      <div className="template-manager-header">
        <div className="header-info">
          <h3>🗂️ Custom Columns for "{category.name}"</h3>
          <p className="hint">Add custom columns to track additional data for all products in this category</p>
        </div>
        <button 
          className="btn-add-column-manager"
          onClick={() => setShowAddColumn(!showAddColumn)}
          disabled={loading}
        >
          {showAddColumn ? '✕ Cancel' : '+ Add Column'}
        </button>
      </div>

      {showAddColumn && (
        <form className="add-column-form-manager" onSubmit={handleAddColumn}>
          <input
            type="text"
            placeholder="Column name (e.g., SKU, Supplier, Cost)"
            value={newColumn.name}
            onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
            required
            autoFocus
          />
          <select
            value={newColumn.type}
            onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value })}
          >
            {columnTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <button type="submit" disabled={loading || !newColumn.name.trim()}>
            {loading ? 'Adding...' : 'Add Column'}
          </button>
        </form>
      )}

      <div className="template-columns-list">
        {templateColumns.length === 0 ? (
          <div className="empty-columns">
            <p>No custom columns yet. Click "Add Column" to create your first custom field.</p>
          </div>
        ) : (
          <div className="columns-grid">
            {templateColumns.sort((a, b) => a.order - b.order).map((column) => (
              <div key={column.columnId} className="column-chip">
                <div className="column-chip-info">
                  <span className="column-name">{column.columnName}</span>
                  <span className="column-type-badge">{column.columnType}</span>
                </div>
                <button
                  className="btn-delete-chip"
                  onClick={() => handleDeleteColumn(column.columnId)}
                  disabled={loading}
                  title="Delete column"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
