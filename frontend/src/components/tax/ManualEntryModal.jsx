import React, { useState } from 'react';
import '../watchlist/AddAssetModal.css';
import '../watchlist/WatchlistCard.css';
import './ManualEntryModal.css';

const EMPTY = {
  assetName: '',
  ticker: '',
  type: 'stock',
  sellDate: '',
  qty: '',
  buyCostEur: '',
  sellPriceEur: '',
  currency: 'EUR',
  note: '',
};

export default function ManualEntryModal({ platform, year, accountId, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const gainEur =
    form.qty && form.buyCostEur && form.sellPriceEur
      ? +((parseFloat(form.sellPriceEur) - parseFloat(form.buyCostEur)) * parseFloat(form.qty)).toFixed(2)
      : null;

  function validate() {
    const e = {};
    if (!form.assetName.trim()) e.assetName = 'Required';
    if (!form.ticker.trim())    e.ticker    = 'Required';
    if (!form.sellDate)         e.sellDate  = 'Required';
    if (!form.qty || isNaN(parseFloat(form.qty))) e.qty = 'Required';
    if (!form.buyCostEur  || isNaN(parseFloat(form.buyCostEur)))  e.buyCostEur  = 'Required';
    if (!form.sellPriceEur || isNaN(parseFloat(form.sellPriceEur))) e.sellPriceEur = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const entry = {
      id: `tx-manual-${Date.now()}`,
      assetName:    form.assetName.trim(),
      ticker:       form.ticker.trim().toUpperCase(),
      type:         form.type,
      sellDate:     form.sellDate,
      qty:          parseFloat(form.qty),
      buyCostEur:   parseFloat(form.buyCostEur),
      sellPriceEur: parseFloat(form.sellPriceEur),
      gainEur:      gainEur ?? 0,
      currency:     form.currency,
      note:         form.note.trim() || undefined,
      source:       'manual',
      platform,
      year,
    };
    // Persist to localStorage
    const key = `tax-manual-${accountId}-${year}-${platform}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]');
    existing.push(entry);
    localStorage.setItem(key, JSON.stringify(existing));
    onSaved(entry);
    onClose();
  }

  const isGainPos = gainEur != null && gainEur > 0;
  const isGainNeg = gainEur != null && gainEur < 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal manual-entry-modal">
        <div className="modal-header">
          <span>Add Manual Entry — {platform} {year}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Row 1: Name + Ticker */}
          <div className="me-row">
            <div className="modal-field me-field-grow">
              <label className="modal-label">Asset Name *</label>
              <input
                className={`wl-input ${errors.assetName ? 'wl-input--error' : ''}`}
                placeholder="e.g. Nokia Oyj"
                value={form.assetName}
                onChange={(e) => set('assetName', e.target.value)}
              />
            </div>
            <div className="modal-field me-field-short">
              <label className="modal-label">Ticker *</label>
              <input
                className={`wl-input ${errors.ticker ? 'wl-input--error' : ''}`}
                placeholder="NOKIA"
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: Type + Currency + Sell Date */}
          <div className="me-row">
            <div className="modal-field">
              <label className="modal-label">Asset Type</label>
              <select className="wl-input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="stock">Stock</option>
                <option value="etf">ETF</option>
                <option value="fund">Fund</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">Currency</label>
              <select className="wl-input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="SEK">SEK</option>
                <option value="DKK">DKK</option>
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">Sell Date *</label>
              <input
                className={`wl-input ${errors.sellDate ? 'wl-input--error' : ''}`}
                type="date"
                value={form.sellDate}
                onChange={(e) => set('sellDate', e.target.value)}
              />
            </div>
          </div>

          {/* Row 3: Qty + Buy cost + Sell price */}
          <div className="me-row">
            <div className="modal-field">
              <label className="modal-label">Quantity *</label>
              <input
                className={`wl-input ${errors.qty ? 'wl-input--error' : ''}`}
                type="number"
                placeholder="0"
                value={form.qty}
                onChange={(e) => set('qty', e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Buy Cost (€/unit) *</label>
              <input
                className={`wl-input ${errors.buyCostEur ? 'wl-input--error' : ''}`}
                type="number"
                placeholder="0.00"
                value={form.buyCostEur}
                onChange={(e) => set('buyCostEur', e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Sell Price (€/unit) *</label>
              <input
                className={`wl-input ${errors.sellPriceEur ? 'wl-input--error' : ''}`}
                type="number"
                placeholder="0.00"
                value={form.sellPriceEur}
                onChange={(e) => set('sellPriceEur', e.target.value)}
              />
            </div>
          </div>

          {/* Computed gain */}
          {gainEur != null && (
            <div className={`me-gain-preview ${isGainPos ? 'me-gain--pos' : isGainNeg ? 'me-gain--neg' : ''}`}>
              Computed gain / loss:&nbsp;
              <strong>
                {gainEur >= 0 ? '+' : ''}€{Math.abs(gainEur).toLocaleString('fi-FI', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          )}

          {/* Note */}
          <div className="modal-field">
            <label className="modal-label">Note (optional)</label>
            <input
              className="wl-input"
              placeholder="e.g. Converted to BTC"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="wl-btn" onClick={onClose}>Cancel</button>
          <button className="wl-btn wl-btn--primary" onClick={handleSave}>Save Entry</button>
        </div>
      </div>
    </div>
  );
}
