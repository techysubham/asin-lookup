import { useState, useEffect } from 'react';
import './TemplateSpreadsheet.css';

export default function TemplateSpreadsheet({ product, onClose, apiBase }) {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('text');
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);

  useEffect(() => {
    if (product) {
      loadTemplateData();
    }
  }, [product]);

  const loadTemplateData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/products/${product.asin}/spreadsheet`);
      if (res.ok) {
        const data = await res.json();
        
        // Initialize default columns if empty
        let loadedColumns = data.columns && data.columns.length > 0 
          ? data.columns 
          : Array.from({ length: 10 }, (_, i) => ({
              id: `col_${i + 1}`,
              name: String.fromCharCode(65 + i), // A, B, C, etc.
              type: 'text',
              width: 150
            }));
        setColumns(loadedColumns);
        
        // Initialize default rows if empty
        if (data.rows && data.rows.length > 0) {
          // Convert Map to plain object for easier access
          const normalizedRows = data.rows.map(row => ({
            ...row,
            cells: typeof row.cells === 'object' && row.cells !== null
              ? (row.cells instanceof Map ? Object.fromEntries(row.cells) : row.cells)
              : {}
          }));
          setRows(normalizedRows);
        } else {
          // Initialize 10 default rows
          const defaultRows = Array.from({ length: 10 }, (_, i) => ({
            id: `row_${i + 1}`,
            cells: loadedColumns.reduce((acc, col) => {
              acc[col.id] = '';
              return acc;
            }, {})
          }));
          setRows(defaultRows);
        }
      }
    } catch (err) {
      console.error('Error loading template:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveTemplateData = async () => {
    try {
      await fetch(`${apiBase}/products/${product.asin}/spreadsheet`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns, rows })
      });
      alert('✅ Spreadsheet saved successfully!');
    } catch (err) {
      alert('Error saving template: ' + err.message);
    }
  };

  const addRow = () => {
    const newRow = {
      id: `row_${Date.now()}`,
      cells: columns.reduce((acc, col) => {
        acc[col.id] = '';
        return acc;
      }, {})
    };
    setRows([...rows, newRow]);
  };

  const addColumn = () => {
    if (!newColumnName.trim()) {
      alert('Please enter a column name');
      return;
    }
    const newCol = {
      id: `col_${Date.now()}`,
      name: newColumnName,
      type: newColumnType,
      width: 150
    };
    setColumns([...columns, newCol]);
    // Add empty cell for this column in all existing rows
    setRows(rows.map(row => ({
      ...row,
      cells: { ...row.cells, [newCol.id]: '' }
    })));
    setNewColumnName('');
    setNewColumnType('text');
    setShowColumnMenu(false);
  };

  const deleteRow = (rowId) => {
    if (confirm('Delete this row?')) {
      setRows(rows.filter(r => r.id !== rowId));
    }
  };

  const deleteColumn = (columnId) => {
    if (confirm('Delete this column? This will remove all data in this column.')) {
      setColumns(columns.filter(c => c.id !== columnId));
      setRows(rows.map(row => {
        const newCells = { ...row.cells };
        delete newCells[columnId];
        return { ...row, cells: newCells };
      }));
    }
  };

  const renameColumn = (columnId, newName) => {
    setColumns(columns.map(col => 
      col.id === columnId ? { ...col, name: newName } : col
    ));
  };

  const startEditing = (rowId, colId, currentValue) => {
    setEditingCell({ rowId, colId });
    setEditValue(currentValue || '');
  };

  const saveCell = () => {
    if (editingCell) {
      const { rowId, colId } = editingCell;
      setRows(rows.map(row => {
        if (row.id === rowId) {
          return {
            ...row,
            cells: { ...row.cells, [colId]: editValue }
          };
        }
        return row;
      }));
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveCell();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleContextMenu = (e, columnId) => {
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      columnId
    });
    setSelectedColumn(columnId);
  };

  const resizeColumn = (columnId, newWidth) => {
    setColumns(columns.map(col =>
      col.id === columnId ? { ...col, width: newWidth } : col
    ));
  };

  if (!product) {
    return (
      <div className="template-container">
        <div className="no-selection">
          <p>👆 Please select a product to use the template</p>
        </div>
      </div>
    );
  }

  return (
    <div className="template-container">
      <div className="template-header">
        <div>
          <h2>📊 Spreadsheet Template</h2>
          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
            Product: {product.asin} - {product.title}
          </p>
        </div>
        <div className="template-actions">
          <button onClick={onClose} className="btn-close">✕ Close</button>
          <button onClick={addRow} className="btn-add-row">+ Add Row</button>
          <button onClick={() => setShowColumnMenu(!showColumnMenu)} className="btn-add-column">
            + Add Column
          </button>
          <button onClick={saveTemplateData} className="btn-save">💾 Save</button>
          <button onClick={loadTemplateData} className="btn-refresh">↻ Refresh</button>
        </div>
      </div>

      {showColumnMenu && (
        <div className="column-menu">
          <input
            type="text"
            placeholder="Column Name"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
          />
          <select value={newColumnType} onChange={(e) => setNewColumnType(e.target.value)}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="url">URL</option>
            <option value="email">Email</option>
          </select>
          <button onClick={addColumn} className="btn-submit">Add</button>
          <button onClick={() => setShowColumnMenu(false)} className="btn-cancel">Cancel</button>
        </div>
      )}

      {loading && <div className="loading">Loading template...</div>}

      <div className="spreadsheet-wrapper">
        <table className="spreadsheet-table">
          <thead>
            <tr>
              <th className="row-number-header">#</th>
              {columns.map((col, idx) => (
                <th
                  key={col.id}
                  style={{ width: col.width }}
                  className="column-header"
                  onContextMenu={(e) => handleContextMenu(e, col.id)}
                >
                  <div className="column-header-content">
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => renameColumn(col.id, e.target.value)}
                      className="column-name-input"
                    />
                    <button
                      onClick={() => deleteColumn(col.id)}
                      className="btn-delete-col"
                      title="Delete column"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="column-type-badge">{col.type}</div>
                </th>
              ))}
              <th className="actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={row.id}>
                <td className="row-number">{rowIdx + 1}</td>
                {columns.map((col) => {
                  const cellValue = row.cells[col.id] || '';
                  const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                  
                  return (
                    <td
                      key={col.id}
                      className={`spreadsheet-cell ${isEditing ? 'editing' : ''}`}
                      onClick={() => !isEditing && startEditing(row.id, col.id, cellValue)}
                    >
                      {isEditing ? (
                        <input
                          type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveCell}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          className="cell-input"
                        />
                      ) : (
                        <span className="cell-value">{cellValue || ''}</span>
                      )}
                    </td>
                  );
                })}
                <td className="actions-cell">
                  <button onClick={() => deleteRow(row.id)} className="btn-delete-row" title="Delete row">
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button onClick={() => {
            deleteColumn(contextMenu.columnId);
            setContextMenu(null);
          }}>
            Delete Column
          </button>
          <button onClick={() => {
            const colName = prompt('Enter new column name:');
            if (colName) {
              renameColumn(contextMenu.columnId, colName);
            }
            setContextMenu(null);
          }}>
            Rename Column
          </button>
        </div>
      )}

      <div className="template-info">
        <p>💡 Click any cell to edit. Press Enter to save, Escape to cancel.</p>
        <p>Right-click column headers for more options.</p>
      </div>
    </div>
  );
}
