import React, { useState, useEffect, useMemo } from 'react';
import { useActiveAccount } from '../../hooks/useAccounts.js';
import '../watchlist/AddAssetModal.css';
import '../watchlist/WatchlistCard.css';
import './AddAlertModal.css';

const EMPTY = {
  type:        'price_target',
  condition:   'above',
  ticker:      '',
  name:        '',
  targetValue: '',
  currency:    'USD',
  notifyVia:   ['in_app'],
  email:       '',
  notes:       '',
};

// Condition options per alert type
const CONDITIONS = {
  price_target:    [{ v: 'above', label: 'rises above' }, { v: 'below', label: 'falls below' }],
  daily_pct_move:  [{ v: 'up_pct', label: 'rises ≥ N% today' }, { v: 'down_pct', label: 'falls ≥ N% today' }],
};

// Build a plain-English description of the alert
function alertDescription(form) {
  if (!form.ticker || !form.targetValue) return null;
  if (form.type === 'price_target') {
    const dir = form.condition === 'above' ? 'rises above' : 'falls below';
    return `Alert me when ${form.ticker} ${dir} ${form.currency} ${form.targetValue}`;
  }
  const dir = form.condition === 'up_pct' ? 'rises' : 'falls';
  return `Alert me when ${form.ticker} ${dir} ${form.targetValue}% or more today`;
}

// Mock email preview
function EmailPreview({ form }) {
  const desc = alertDescription(form);
  if (!desc) return null;
  return (
    <div className="aa-email-preview">
      <div className="aa-email-preview-label">Email preview (mock — Phase 2 will send real emails)</div>
      <div className="aa-email-body">
        <div className="aa-email-subject">
          Subject: ⚠ Price Alert Triggered — {form.ticker || '…'}
        </div>
        <div className="aa-email-content">
          <p>Your price alert has been triggered:</p>
          <p><strong>{desc}</strong></p>
          <p>Current price: <em>[live price will appear here]</em></p>
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
            Investing Agent · Mock Mode · Replies not monitored
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AddAlertModal({ editAlert, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    editAlert
      ? { ...EMPTY, ...editAlert, notifyVia: editAlert.notifyVia ?? ['in_app'], email: editAlert.email ?? '' }
      : EMPTY
  );
  const [errors, setErrors] = useState({});

  const { activeAccount } = useActiveAccount();
  const portfolioTickers = useMemo(() => {
    const { nordnet = [], nordea = [], kvarnx = [] } = activeAccount?.holdings ?? {};
    return [...nordnet, ...nordea, ...kvarnx]
      .filter(h => h.ticker)
      .map(h => ({ ticker: h.ticker, name: h.name ?? h.ticker, currency: h.currency ?? 'EUR' }));
  }, [activeAccount]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // When ticker dropdown changes, fill name + currency
  function handleTickerSelect(e) {
    const ticker = e.target.value;
    const match  = portfolioTickers.find((t) => t.ticker === ticker);
    setForm((f) => ({
      ...f,
      ticker,
      name:     match ? match.name     : f.name,
      currency: match ? match.currency : f.currency,
    }));
  }

  // When type changes, reset condition to first option for that type
  function handleTypeChange(newType) {
    const firstCond = CONDITIONS[newType]?.[0]?.v ?? 'above';
    setForm((f) => ({ ...f, type: newType, condition: firstCond }));
  }

  function toggleNotify(channel) {
    setForm((f) => ({
      ...f,
      notifyVia: f.notifyVia.includes(channel)
        ? f.notifyVia.filter((c) => c !== channel)
        : [...f.notifyVia, channel],
    }));
  }

  function validate() {
    const e = {};
    if (!form.ticker.trim())    e.ticker      = 'Required';
    if (!form.targetValue || isNaN(parseFloat(form.targetValue))) e.targetValue = 'Required';
    if (form.notifyVia.includes('email') && !form.email.trim())   e.email = 'Required for email alerts';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const payload = {
      type:        form.type,
      condition:   form.condition,
      ticker:      form.ticker.trim().toUpperCase(),
      name:        form.name.trim() || form.ticker.trim().toUpperCase(),
      targetValue: parseFloat(form.targetValue),
      currency:    form.currency,
      notifyVia:   form.notifyVia,
      email:       form.notifyVia.includes('email') ? form.email.trim() : null,
      notes:       form.notes.trim(),
    };
    onSaved(payload, editAlert?.id ?? null);
    onClose();
  }

  const showEmail = form.notifyVia.includes('email');
  const desc = alertDescription(form);
  const placeholder = form.type === 'price_target' ? '0.00' : '5';
  const targetLabel = form.type === 'price_target'
    ? `Target Price (${form.currency})`
    : 'Threshold (%)';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal aa-modal">
        <div className="modal-header">
          <span>{editAlert ? 'Edit Alert' : 'New Price Alert'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">

          {/* Alert type */}
          <div className="modal-field">
            <label className="modal-label">Alert Type</label>
            <div className="aa-type-btns">
              {[
                { v: 'price_target',   label: 'Price Target',  icon: '◎' },
                { v: 'daily_pct_move', label: 'Daily % Move',  icon: '◐' },
              ].map(({ v, label, icon }) => (
                <button
                  key={v}
                  className={`aa-type-btn ${form.type === v ? 'aa-type-btn--active' : ''}`}
                  onClick={() => handleTypeChange(v)}
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Ticker row */}
          <div className="aa-row">
            <div className="modal-field aa-field-grow">
              <label className="modal-label">Ticker *</label>
              <div className="aa-ticker-row">
                <select
                  className="wl-input"
                  value={portfolioTickers.find((t) => t.ticker === form.ticker) ? form.ticker : ''}
                  onChange={handleTickerSelect}
                >
                  <option value="">
                    {portfolioTickers.length ? '— Select from portfolio —' : '— Loading holdings… —'}
                  </option>
                  {portfolioTickers.map((t) => (
                    <option key={t.ticker} value={t.ticker}>{t.ticker} — {t.name}</option>
                  ))}
                </select>
                <span className="aa-or">or</span>
                <input
                  className={`wl-input aa-ticker-input ${errors.ticker ? 'wl-input--error' : ''}`}
                  placeholder="Custom ticker"
                  value={form.ticker}
                  onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>

          {/* Name + Currency row */}
          <div className="aa-row">
            <div className="modal-field aa-field-grow">
              <label className="modal-label">Asset Name</label>
              <input
                className="wl-input"
                placeholder="e.g. Apple Inc."
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Currency</label>
              <select className="wl-input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="SEK">SEK</option>
                <option value="DKK">DKK</option>
              </select>
            </div>
          </div>

          {/* Condition + Target row */}
          <div className="aa-row">
            <div className="modal-field">
              <label className="modal-label">Condition</label>
              <select
                className="wl-input"
                value={form.condition}
                onChange={(e) => set('condition', e.target.value)}
              >
                {(CONDITIONS[form.type] ?? []).map(({ v, label }) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">{targetLabel} *</label>
              <input
                className={`wl-input ${errors.targetValue ? 'wl-input--error' : ''}`}
                type="number"
                placeholder={placeholder}
                value={form.targetValue}
                onChange={(e) => set('targetValue', e.target.value)}
              />
            </div>
          </div>

          {/* Plain-English summary */}
          {desc && (
            <div className="aa-description">{desc}</div>
          )}

          {/* Delivery */}
          <div className="modal-field">
            <label className="modal-label">Notify via</label>
            <div className="aa-notify-row">
              {[
                { key: 'in_app', label: 'In-app' },
                { key: 'email',  label: 'Email'  },
              ].map(({ key, label }) => (
                <label key={key} className={`aa-notify-toggle ${form.notifyVia.includes(key) ? 'aa-notify-toggle--on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.notifyVia.includes(key)}
                    onChange={() => toggleNotify(key)}
                  />
                  {key === 'in_app' ? '◎' : '✉'} {label}
                </label>
              ))}
            </div>
          </div>

          {/* Email input */}
          {showEmail && (
            <div className="modal-field">
              <label className="modal-label">Email address *</label>
              <input
                className={`wl-input ${errors.email ? 'wl-input--error' : ''}`}
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
          )}

          {/* Email preview */}
          {showEmail && <EmailPreview form={form} />}

          {/* Notes */}
          <div className="modal-field">
            <label className="modal-label">Notes (optional)</label>
            <input
              className="wl-input"
              placeholder="e.g. Part of earnings play thesis"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="wl-btn" onClick={onClose}>Cancel</button>
          <button className="wl-btn wl-btn--primary" onClick={handleSave}>
            {editAlert ? 'Save Changes' : 'Create Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}
