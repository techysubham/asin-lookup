import { useState } from 'react';
import './ProductTemplate.css';

export default function ProductTemplate({ product, apiBase, onUpdate }) {
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumn, setNewColumn] = useState({ name: '', type: 'text', value: '' });
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);

  const columnTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'url', label: 'URL' },
    { value: 'textarea', label: 'Long Text' }
  ];

  // Add new column
  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumn.name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/products/${product.asin}/template/column`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnName: newColumn.name.trim(),
          columnType: newColumn.type,
          value: newColumn.value
        })
      });

      if (!res.ok) throw new Error('Failed to add column');
      
      const updatedProduct = await res.json();
      onUpdate(updatedProduct);
      
      // Reset form
      setNewColumn({ name: '', type: 'text', value: '' });
      setShowAddColumn(false);
    } catch (err) {
      console.error('Error adding column:', err);
      alert('Failed to add column: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update column value
  const handleUpdateValue = async (columnId, newValue) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/products/${product.asin}/template/column/${columnId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue })
      });

      if (!res.ok) throw new Error('Failed to update value');
      
      const updatedProduct = await res.json();
      onUpdate(updatedProduct);
      setEditingCell(null);
    } catch (err) {
      console.error('Error updating value:', err);
      alert('Failed to update value: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update column name
  const handleUpdateColumnName = async (columnId, newName) => {
    if (!newName.trim()) {
      alert('Column name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/products/${product.asin}/template/column/${columnId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnName: newName.trim() })
      });

      if (!res.ok) throw new Error('Failed to update column name');
      
      const updatedProduct = await res.json();
      onUpdate(updatedProduct);
      setEditingCell(null);
    } catch (err) {
      console.error('Error updating column name:', err);
      alert('Failed to update column name: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete column
  const handleDeleteColumn = async (columnId) => {
    if (!confirm('Are you sure you want to delete this column? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/products/${product.asin}/template/column/${columnId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete column');
      
      const updatedProduct = await res.json();
      onUpdate(updatedProduct);
    } catch (err) {
      console.error('Error deleting column:', err);
      alert('Failed to delete column: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Start editing cell
  const startEdit = (columnId, field, currentValue) => {
    setEditingCell({ columnId, field });
    setEditValue(currentValue || '');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Save edit
  const saveEdit = () => {
    if (editingCell.field === 'name') {
      handleUpdateColumnName(editingCell.columnId, editValue);
    } else {
      handleUpdateValue(editingCell.columnId, editValue);
    }
  };

  // Handle key press in edit mode
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const template = product.template || [];

  return (
    <div className="product-template">
      <div className="template-header">
        <h3>📋 Custom Template</h3>
        <button 
          className="btn-add-column"
          onClick={() => setShowAddColumn(!showAddColumn)}
          disabled={loading}
        >
          {showAddColumn ? '✕ Cancel' : '+ Add Column'}
        </button>
      </div>

      {showAddColumn && (
        <form className="add-column-form" onSubmit={handleAddColumn}>
          <input
            type="text"
            placeholder="Column name"
            value={newColumn.name}
            onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
            required
          />
          <select
            value={newColumn.type}
            onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value })}
          >
            {columnTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Initial value (optional)"
            value={newColumn.value}
            onChange={(e) => setNewColumn({ ...newColumn, value: e.target.value })}
          />
          <button type="submit" disabled={loading || !newColumn.name.trim()}>
            {loading ? 'Adding...' : 'Add Column'}
          </button>
        </form>
      )}

      {template.length === 0 ? (
        <div className="empty-template">
          <p>No custom columns yet. Click "Add Column" to create your first column.</p>
        </div>
      ) : (
        <div className="template-table-wrapper">
          <table className="template-table">
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Type</th>
                <th>Value</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {template.sort((a, b) => a.order - b.order).map((column) => (
                <tr key={column.columnId}>
                  <td className="column-name-cell">
                    {editingCell?.columnId === column.columnId && editingCell?.field === 'name' ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        onBlur={saveEdit}
                        autoFocus
                        className="edit-input"
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(column.columnId, 'name', column.columnName)}
                        className="editable-cell"
                        title="Click to edit"
                      >
                        {column.columnName}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="type-badge">{column.columnType}</span>
                  </td>
                  <td className="value-cell">
                    {editingCell?.columnId === column.columnId && editingCell?.field === 'value' ? (
                      column.columnType === 'textarea' ? (
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyPress}
                          onBlur={saveEdit}
                          autoFocus
                          className="edit-textarea"
                          rows={3}
                        />
                      ) : (
                        <input
                          type={column.columnType === 'number' ? 'number' : column.columnType === 'date' ? 'date' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyPress}
                          onBlur={saveEdit}
                          autoFocus
                          className="edit-input"
                        />
                      )
                    ) : (
                      <span
                        onClick={() => startEdit(column.columnId, 'value', column.value)}
                        className="editable-cell"
                        title="Click to edit"
                      >
                        {column.columnType === 'url' && column.value ? (
                          <a href={column.value} target="_blank" rel="noopener noreferrer">
                            {column.value}
                          </a>
                        ) : (
                          column.value || <span className="empty-value">Empty</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-delete-column"
                      onClick={() => handleDeleteColumn(column.columnId)}
                      disabled={loading}
                      title="Delete column"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
