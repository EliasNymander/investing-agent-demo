import React, { useState } from 'react';
import { addWatchlistItem } from '../../api/watchlist.js';
import './AddAssetModal.css';

const EXCHANGES = ['NASDAQ', 'NYSE', 'OMX', 'LSE', 'Xetra', 'Crypto', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'SEK', 'DKK', 'GBP', 'NOK'];
const ASSET_CLASSES = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'fund', label: 'Fund' },
  { value: 'crypto', label: 'Crypto' },
];

export default function AddAssetModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    ticker: '', name: '', exchange: 'NASDAQ', assetClass: 'stock', currency: 'USD', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.ticker.trim()) { setError('Ticker is required'); return; }
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const item = await addWatchlistItem({ ...form, ticker: form.ticker.trim().toUpperCase() });
      onAdded(item);
      onClose();
    } catch (e) {
      setError('Failed to add: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Add to Watchlist</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="modal-note">
            In Phase 1 (mock mode), only pre-defined tickers have price history.
            Any ticker can be added — price will show "unavailable" if not in mock data.
          </div>

          <div className="modal-field">
            <label className="modal-label">Ticker Symbol *</label>
            <input
              className="wl-input"
              placeholder="e.g. TSLA"
              value={form.ticker}
              onChange={(e) => set('ticker', e.target.value.toUpperCase())}
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">Full Name *</label>
            <input
              className="wl-input"
              placeholder="e.g. Tesla Inc."
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Asset Class</label>
              <select className="wl-select" value={form.assetClass} onChange={(e) => set('assetClass', e.target.value)}>
                {ASSET_CLASSES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">Exchange</label>
              <select className="wl-select" value={form.exchange} onChange={(e) => set('exchange', e.target.value)}>
                {EXCHANGES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">Currency</label>
              <select className="wl-select" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">Research Notes (optional)</label>
            <textarea
              className="wl-input"
              placeholder="Why are you watching this? What's the thesis?"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {error && <div className="error-msg" style={{ marginTop: 0 }}>{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="wl-btn" onClick={onClose}>Cancel</button>
          <button className="wl-btn wl-btn--primary" onClick={submit} disabled={saving}>
            {saving ? 'Adding…' : 'Add to Watchlist'}
          </button>
        </div>
      </div>
    </div>
  );
}
