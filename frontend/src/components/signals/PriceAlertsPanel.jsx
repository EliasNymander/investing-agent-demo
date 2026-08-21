import React, { useState, useCallback, useMemo } from 'react';
import { usePriceAlerts } from '../../hooks/usePriceAlerts.js';
import { addPriceAlert, updatePriceAlert, deletePriceAlert } from '../../api/priceAlerts.js';
import AddAlertModal from './AddAlertModal.jsx';
import { DEMO_MODE } from '../../api/demoFetch.js';
import './PriceAlertsPanel.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'pa-dismissed';

// Mirrors WatchlistCard.jsx's SYM map (same problem, same codebase) plus NOK,
// which is used in watchlist.json but was missing there too.
const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', SEK: 'kr', DKK: 'kr', NOK: 'kr', GBP: '£' };

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]')); }
  catch { return new Set(); }
}

function saveDismissed(set) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
}

function fmtPrice(v, currency) {
  if (v == null) return '—';
  const sym = CURRENCY_SYMBOLS[currency];
  // Threshold selection must key off magnitude, not the signed value -- a
  // negative v otherwise fails every ">=" branch and falls into the 4-decimal
  // case meant for sub-1 magnitudes (SCRUM-66). v itself (still signed) goes
  // to toLocaleString, which already renders the "-" correctly on its own.
  const mag = Math.abs(v);
  const decimals = mag >= 1000 ? 0 : mag >= 10 ? 2 : mag >= 1 ? 3 : 4;
  const formatted = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  // Unmapped currency: show the raw ISO code instead of silently defaulting
  // to $ (visibly wrong beats silently wrong as USD).
  return sym ? `${sym}${formatted}` : `${formatted} ${currency}`;
}

function fmtPct(v) {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function conditionLabel(alert) {
  if (alert.type === 'price_target') {
    const dir = alert.condition === 'above' ? 'above' : 'below';
    return `Price ${dir} ${fmtPrice(alert.targetValue, alert.currency)}`;
  }
  const dir = alert.condition === 'up_pct' ? 'up' : 'down';
  return `Daily move ${dir} ≥ ${alert.targetValue}%`;
}

function statusLabel(alert) {
  if (alert.currentPrice == null) return { text: 'Price unavailable', cls: 'pa-status--unknown' };
  if (alert.type === 'price_target') {
    const dist = alert.distanceToTarget;
    const sign = dist > 0 ? '+' : '';
    const distStr = `${sign}${fmtPrice(dist, alert.currency)} from target`;
    return alert.triggered
      ? { text: `Triggered — current ${fmtPrice(alert.currentPrice, alert.currency)}`, cls: 'pa-status--triggered' }
      : { text: `Current ${fmtPrice(alert.currentPrice, alert.currency)} · ${distStr}`, cls: 'pa-status--pending' };
  }
  // daily_pct_move
  return alert.triggered
    ? { text: `Triggered — today ${fmtPct(alert.dailyPct)}`, cls: 'pa-status--triggered' }
    : { text: `Today ${fmtPct(alert.dailyPct)}`, cls: 'pa-status--pending' };
}

function DeliveryChips({ notifyVia }) {
  return (
    <div className="pa-delivery">
      {notifyVia.includes('in_app') && <span className="pa-chip pa-chip--app">◎ In-app</span>}
      {notifyVia.includes('email')  && <span className="pa-chip pa-chip--email">✉ Email</span>}
    </div>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────

function AlertCard({ alert, dismissed, onDismiss, onEdit, onDelete }) {
  const isDismissed = dismissed.has(alert.id);
  const st          = statusLabel(alert);
  const isTriggered = alert.triggered && !isDismissed;
  const typeLabel   = alert.type === 'price_target' ? 'PRICE TARGET' : 'DAILY MOVE';

  return (
    <div className={`pa-card ${isTriggered ? 'pa-card--triggered' : ''}`}>
      <div className="pa-card-top">
        <span className="pa-type-badge">{typeLabel}</span>
        <span className="pa-ticker">{alert.ticker}</span>
        <span className="pa-name">{alert.name}</span>
        {isTriggered && <span className="pa-triggered-badge">⚡ TRIGGERED</span>}
        <div className="pa-card-actions">
          {isTriggered && (
            <button className="pa-action-btn pa-dismiss-btn" onClick={() => onDismiss(alert.id)}>Dismiss</button>
          )}
          {!DEMO_MODE && (
            <>
              <button className="pa-action-btn" onClick={() => onEdit(alert)} title="Edit">✎</button>
              <button className="pa-action-btn pa-delete-btn" onClick={() => onDelete(alert.id)} title="Delete">✕</button>
            </>
          )}
        </div>
      </div>

      <div className="pa-condition">{conditionLabel(alert)}</div>
      <div className={`pa-status ${st.cls}`}>{st.text}</div>

      <div className="pa-card-footer">
        <DeliveryChips notifyVia={alert.notifyVia} />
        {alert.notes && <span className="pa-notes">{alert.notes}</span>}
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function PriceAlertsPanel() {
  const { alerts, isLoading, error, mutate } = usePriceAlerts();
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [modal,     setModal]     = useState(null); // null | 'new' | alert-object

  const triggered = useMemo(
    () => alerts.filter((a) => a.active && a.triggered && !dismissed.has(a.id)),
    [alerts, dismissed]
  );

  const pending = useMemo(
    () => alerts.filter((a) => a.active && (!a.triggered || dismissed.has(a.id))),
    [alerts, dismissed]
  );

  const handleDismiss = useCallback((id) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const handleSaved = useCallback(async (payload, editId) => {
    if (editId) {
      await updatePriceAlert(editId, payload);
    } else {
      await addPriceAlert(payload);
    }
    mutate();
  }, [mutate]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this alert?')) return;
    await deletePriceAlert(id);
    mutate();
  }, [mutate]);

  if (isLoading) return <div className="loading" style={{ padding: '48px 32px' }}>Loading alerts…</div>;
  if (error)     return <div className="error-msg" style={{ margin: '24px 32px' }}>Failed to load price alerts.</div>;

  return (
    <div className="pa-panel">

      {/* Header bar */}
      <div className="pa-panel-bar">
        <div className="pa-panel-counts">
          <span className="pa-count-total">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
          {triggered.length > 0 && (
            <span className="pa-count-triggered">· {triggered.length} triggered</span>
          )}
        </div>
        {!DEMO_MODE && (
          <button className="pa-add-btn" onClick={() => setModal('new')}>
            + New Alert
          </button>
        )}
      </div>

      {/* Triggered section */}
      {triggered.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-header pa-section-header--triggered">
            ⚡ Triggered ({triggered.length})
          </div>
          <div className="pa-grid">
            {triggered.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                dismissed={dismissed}
                onDismiss={handleDismiss}
                onEdit={setModal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active / pending section */}
      {pending.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-header">
            Active ({pending.length})
          </div>
          <div className="pa-grid">
            {pending.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                dismissed={dismissed}
                onDismiss={handleDismiss}
                onEdit={setModal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="pa-empty">
          <div className="pa-empty-icon">◎</div>
          <div className="pa-empty-title">No price alerts yet</div>
          <div className="pa-empty-sub">
            Set a target like "ASML above €950" or "BTC up 5% today" and get notified when it triggers.
          </div>
          {!DEMO_MODE && (
            <button className="pa-add-btn" onClick={() => setModal('new')}>+ Create your first alert</button>
          )}
        </div>
      )}

      {/* Phase 2 note */}
      <div className="pa-phase2-note">
        Phase 2: Real-time price polling will check alerts every 60s and push browser notifications + emails.
      </div>

      {/* Modal */}
      {!DEMO_MODE && modal && (
        <AddAlertModal
          editAlert={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
