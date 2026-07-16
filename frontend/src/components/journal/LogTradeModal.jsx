import React, { useState, useEffect, useMemo } from 'react';
import { useSignals } from '../../hooks/useSignals.js';
import '../watchlist/AddAssetModal.css';
import '../watchlist/WatchlistCard.css';
import './LogTradeModal.css';

const PLATFORMS  = ['Nordnet', 'Nordea', 'KvarnX', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'SEK', 'DKK'];
const ASSET_CLASSES = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf',   label: 'ETF' },
  { value: 'fund',  label: 'Fund' },
  { value: 'crypto', label: 'Crypto' },
];

// Static FX rates (same as backend/utils/currency.js)
const USD_EUR = 1 / 1.085;
const SEK_EUR = 1 / 11.42;

function toEurFront(amount, currency) {
  if (currency === 'EUR') return amount;
  if (currency === 'USD') return amount * USD_EUR;
  if (currency === 'SEK') return amount * SEK_EUR;
  return amount;
}

function fmtEur(n) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

const BLANK = {
  action: 'BUY', ticker: '', name: '', assetClass: 'stock', platform: 'Nordnet',
  currency: 'USD', qty: '', price: '', date: '', reasoning: '', confidence: 3,
  signalRef: '', linkedBuyId: '',
};

export default function LogTradeModal({ onClose, onSaved, editEntry, openBuys }) {
  const isEdit = !!editEntry;
  const { signals } = useSignals();

  const [form, setForm] = useState(() => {
    if (isEdit) {
      return {
        ...BLANK,
        ...editEntry,
        signalRef:   editEntry.signalRef ? editEntry.signalRef.id : '',
        linkedBuyId: editEntry.linkedBuyId ?? '',
        date:        editEntry.date ? editEntry.date.slice(0, 10) : '',
      };
    }
    return { ...BLANK, date: new Date().toISOString().slice(0, 10) };
  });

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const totalNative = useMemo(() => {
    const q = parseFloat(form.qty);
    const p = parseFloat(form.price);
    return !isNaN(q) && !isNaN(p) ? q * p : null;
  }, [form.qty, form.price]);

  const totalEurDisplay = useMemo(() => {
    if (totalNative == null) return null;
    return toEurFront(totalNative, form.currency);
  }, [totalNative, form.currency]);

  // Filtered open BUY entries for the same ticker (SELL linking)
  const matchingBuys = useMemo(() => {
    if (form.action !== 'SELL' || !form.ticker) return [];
    return (openBuys ?? []).filter(
      (e) => e.ticker === form.ticker.toUpperCase() && e.action === 'BUY'
    );
  }, [form.action, form.ticker, openBuys]);

  const submit = async () => {
    if (!form.ticker.trim())   { setError('Ticker is required');   return; }
    if (!form.name.trim())     { setError('Name is required');     return; }
    if (!form.qty || isNaN(parseFloat(form.qty)))  { setError('Quantity is required'); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { setError('Price is required'); return; }
    if (!form.reasoning.trim()) { setError('Reasoning is required'); return; }

    setSaving(true);
    setError('');
    try {
      const signalObj = form.signalRef
        ? signals?.find((s) => s.id === form.signalRef) ?? null
        : null;
      const payload = {
        ...form,
        ticker:      form.ticker.trim().toUpperCase(),
        qty:         parseFloat(form.qty),
        price:       parseFloat(form.price),
        date:        form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
        confidence:  parseInt(form.confidence, 10),
        signalRef:   signalObj ? { id: signalObj.id, type: signalObj.type, ticker: signalObj.ticker } : null,
        linkedBuyId: form.linkedBuyId || null,
      };
      await onSaved(payload);
      onClose();
    } catch (e) {
      setError('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal ltm-modal">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Trade' : 'Log Trade'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Row 1: Action + Ticker + Platform */}
          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Action</label>
              <div className="ltm-action-row">
                {['BUY', 'SELL'].map((a) => (
                  <button
                    key={a}
                    className={`ltm-action-btn ${form.action === a ? `ltm-action-btn--${a.toLowerCase()}` : ''}`}
                    onClick={() => set('action', a)}
                    type="button"
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-field">
              <label className="modal-label">Ticker *</label>
              <input
                className="wl-input"
                placeholder="e.g. ASML"
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                autoFocus={!isEdit}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Platform</label>
              <select className="wl-select" value={form.platform} onChange={(e) => set('platform', e.target.value)}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Name + Asset Class */}
          <div className="modal-row ltm-row-2col">
            <div className="modal-field">
              <label className="modal-label">Full Name *</label>
              <input
                className="wl-input"
                placeholder="e.g. NVIDIA Corporation"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Asset Class</label>
              <select className="wl-select" value={form.assetClass} onChange={(e) => set('assetClass', e.target.value)}>
                {ASSET_CLASSES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Date + Qty + Price + Currency */}
          <div className="modal-row ltm-row-4col">
            <div className="modal-field">
              <label className="modal-label">Date *</label>
              <input
                className="wl-input"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Quantity *</label>
              <input
                className="wl-input"
                type="number"
                placeholder="0"
                min="0"
                step="any"
                value={form.qty}
                onChange={(e) => set('qty', e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Price *</label>
              <input
                className="wl-input"
                type="number"
                placeholder="0.00"
                min="0"
                step="any"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Currency</label>
              <select className="wl-select" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Computed total */}
          {totalNative != null && (
            <div className="ltm-computed">
              Total:{' '}
              <strong>
                {form.currency === 'EUR' ? '€' : form.currency === 'SEK' ? 'kr' : '$'}
                {totalNative.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
              {form.currency !== 'EUR' && (
                <span className="ltm-eur-equiv"> ≈ {fmtEur(totalEurDisplay)}</span>
              )}
            </div>
          )}

          {/* Reasoning */}
          <div className="modal-field">
            <label className="modal-label">Reasoning * — why are you making this trade?</label>
            <textarea
              className="wl-input ltm-reasoning"
              placeholder="What is your thesis? What signal or catalyst triggered this decision? What could go wrong?"
              rows={4}
              value={form.reasoning}
              onChange={(e) => set('reasoning', e.target.value)}
            />
          </div>

          {/* Confidence */}
          <div className="modal-field">
            <label className="modal-label">Confidence (1–5)</label>
            <div className="ltm-confidence-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ltm-star-btn ${n <= form.confidence ? 'star-active' : ''}`}
                  onClick={() => set('confidence', n)}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Signal link */}
          <div className="modal-field">
            <label className="modal-label">Link to Agent Signal (optional)</label>
            <select className="wl-select" value={form.signalRef} onChange={(e) => set('signalRef', e.target.value)}>
              <option value="">— None —</option>
              {(signals ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.type} {s.ticker} ({s.id})</option>
              ))}
            </select>
          </div>

          {/* SELL: link to original BUY */}
          {form.action === 'SELL' && (
            <div className="modal-field">
              <label className="modal-label">Link to original BUY (optional)</label>
              {matchingBuys.length > 0 ? (
                <select className="wl-select" value={form.linkedBuyId} onChange={(e) => set('linkedBuyId', e.target.value)}>
                  <option value="">— None —</option>
                  {matchingBuys.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.ticker} @ {e.price} {e.currency} · {e.date?.slice(0, 10)} ({e.id})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="modal-note">No open BUY entries found for {form.ticker || 'this ticker'}.</div>
              )}
            </div>
          )}

          {error && <div className="error-msg" style={{ marginTop: 0 }}>{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="wl-btn" onClick={onClose}>Cancel</button>
          <button className="wl-btn wl-btn--primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Trade'}
          </button>
        </div>
      </div>
    </div>
  );
}
