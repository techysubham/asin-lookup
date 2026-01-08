import { useState } from 'react';
import './AccountSelector.css';

export default function AccountSelector({ accounts, selectedAccount, onSelectAccount, onAddAccount }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    email: '',
    description: '',
    status: 'active'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onAddAccount(newAccount);
      setNewAccount({ name: '', email: '', description: '', status: 'active' });
      setShowAddForm(false);
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setNewAccount({ name: '', email: '', description: '', status: 'active' });
    setError('');
  };

  return (
    <div className="account-selector-container">
      <div className="account-selector-header">
        <h3>Account Management</h3>
      </div>

      <div className="account-selector-actions">
        <div className="dropdown-wrapper">
          <label htmlFor="account-select">Select Account:</label>
          <select
            id="account-select"
            value={selectedAccount?._id || ''}
            onChange={(e) => {
              const account = accounts.find(a => a._id === e.target.value);
              onSelectAccount(account);
            }}
            className="account-dropdown"
          >
            <option value="">-- Select an Account --</option>
            {accounts.map((account) => (
              <option key={account._id} value={account._id}>
                {account.name} ({account.email})
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn-add-account"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? '✕ Cancel' : '+ Add New Account'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-account-form">
          <h4>Create New Account</h4>
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="account-name">Account Name *</label>
              <input
                id="account-name"
                type="text"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                placeholder="e.g., Amazon Seller Account"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="account-email">Email *</label>
              <input
                id="account-email"
                type="email"
                value={newAccount.email}
                onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                placeholder="account@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="account-description">Description</label>
              <textarea
                id="account-description"
                value={newAccount.description}
                onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="account-status">Status</label>
              <select
                id="account-status"
                value={newAccount.status}
                onChange={(e) => setNewAccount({ ...newAccount, status: e.target.value })}
                disabled={loading}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Account'}
              </button>
              <button type="button" className="btn-cancel" onClick={handleCancel} disabled={loading}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedAccount && (
        <div className="selected-account-info">
          <h4>Selected Account</h4>
          <p><strong>Name:</strong> {selectedAccount.name}</p>
          <p><strong>Email:</strong> {selectedAccount.email}</p>
          {selectedAccount.description && (
            <p><strong>Description:</strong> {selectedAccount.description}</p>
          )}
          <p><strong>Status:</strong> <span className={`status-badge ${selectedAccount.status}`}>{selectedAccount.status}</span></p>
        </div>
      )}
    </div>
  );
}
