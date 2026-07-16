import React, { useState, useRef, useCallback } from 'react';
import { useTickerHistory } from '../../hooks/useHistory.js';
import PlatformChart from '../platform/PlatformChart.jsx';
import PeriodSelector from '../platform/PeriodSelector.jsx';
import { updateWatchlistItem, removeWatchlistItem, addAlert, removeAlert } from '../../api/watchlist.js';
import './WatchlistCard.css';

const COND_LABEL = { above: '▲ above', below: '▼ below' };
const SYM = { USD: '$', EUR: '€', SEK: 'kr', DKK: 'kr', GBP: '£' };

function AlertRow({ alert, onRemove }) {
  const cls = alert.triggered ? 'alert-row alert-row--triggered' : 'alert-row';
  return (
    <div className={cls}>
      <span className="alert-cond">{COND_LABEL[alert.condition]}</span>
      <span className="alert-price text-mono">
        {alert.targetPrice.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
      </span>
      {alert.label && <span className="alert-label text-muted">{alert.label}</span>}
      {alert.triggered && <span className="badge badge-red" style={{ fontSize: 10 }}>TRIGGERED</span>}
      <button className="alert-remove-btn" onClick={onRemove} title="Remove alert">×</button>
    </div>
  );
}

function AddAlertForm({ onAdd, currency }) {
  const [open, setOpen] = useState(false);
  const [cond, setCond] = useState('below');
  const [price, setPrice] = useState('');
  const [label, setLabel] = useState('');
  const sym = SYM[currency] ?? '';

  const submit = () => {
    if (!price) return;
    onAdd({ condition: cond, targetPrice: parseFloat(price), label });
    setPrice(''); setLabel(''); setOpen(false);
  };

  if (!open) {
    return (
      <button className="alert-add-btn" onClick={() => setOpen(true)}>+ Add price alert</button>
    );
  }

  return (
    <div className="alert-form">
      <select className="wl-select" value={cond} onChange={(e) => setCond(e.target.value)}>
        <option value="below">▼ drops below</option>
        <option value="above">▲ rises above</option>
      </select>
      <div className="alert-price-input-wrap">
        <span className="alert-sym">{sym}</span>
        <input
          className="wl-input"
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          autoFocus
        />
      </div>
      <input
        className="wl-input"
        placeholder="Label (optional)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="alert-form-actions">
        <button className="wl-btn wl-btn--primary" onClick={submit}>Set alert</button>
        <button className="wl-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export default function WatchlistCard({ item, onMutate }) {
  const [period, setPeriod] = useState('1M');
  const [notesOpen, setNotesOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(item.hasTriggeredAlerts || (item.alerts?.length > 0));
  const [notes, setNotes] = useState(item.notes ?? '');
  const [saveStatus, setSaveStatus] = useState('');
  const saveTimer = useRef(null);

  const { history, isLoading: histLoading } = useTickerHistory(item.ticker, period);

  const sym = SYM[item.currency] ?? '';
  const isPos = (item.dailyPct ?? 0) >= 0;
  const watchSincePct = item.priceSinceAdded;

  const saveNotes = useCallback(async (val) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updateWatchlistItem(item.id, { notes: val });
      setSaveStatus('Saved');
      setTimeout(() => setSaveStatus(''), 1500);
      onMutate();
    }, 600);
  }, [item.id, onMutate]);

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
    saveNotes(e.target.value);
  };

  const handleAddAlert = async (alert) => {
    await addAlert(item.id, alert);
    onMutate();
  };

  const handleRemoveAlert = async (alertId) => {
    await removeAlert(item.id, alertId);
    onMutate();
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove ${item.ticker} from watchlist?`)) return;
    await removeWatchlistItem(item.id);
    onMutate();
  };

  const addedDate = new Date(item.addedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={`wl-card ${item.hasTriggeredAlerts ? 'wl-card--alert' : ''}`}>
      {/* Header */}
      <div className="wl-card-header">
        <div className="wl-card-identity">
          <span className="wl-ticker">{item.ticker}</span>
          <span className="wl-exchange badge badge-muted">{item.exchange}</span>
          {item.hasTriggeredAlerts && (
            <span className="badge badge-red" style={{ fontSize: 10 }}>🔔 ALERT</span>
          )}
        </div>
        <button className="wl-remove-btn" onClick={handleRemove} title="Remove from watchlist">×</button>
      </div>
      <div className="wl-name">{item.name}</div>

      {/* Price row */}
      <div className="wl-price-row">
        {item.currentPrice != null ? (
          <>
            <span className="wl-price text-mono">
              {sym}{item.currentPrice.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
            </span>
            <span className={`wl-daily text-mono ${isPos ? 'text-green' : 'text-red'}`}>
              {isPos ? '+' : ''}{item.dailyPct?.toFixed(2)}% today
            </span>
            {watchSincePct != null && (
              <span className={`wl-since text-mono text-muted`}>
                {watchSincePct >= 0 ? '+' : ''}{watchSincePct.toFixed(2)}% since added
              </span>
            )}
          </>
        ) : (
          <span className="text-muted" style={{ fontSize: 12 }}>Price unavailable</span>
        )}
      </div>
      <div className="wl-added text-muted">Added {addedDate}
        {item.addedPrice != null && (
          <span className="text-mono"> · at {sym}{item.addedPrice.toLocaleString('en-IE', { minimumFractionDigits: 2 })}</span>
        )}
      </div>

      {/* Chart */}
      <div className="wl-chart-toolbar">
        <PeriodSelector selected={period} onChange={setPeriod} />
      </div>
      <div className="wl-chart">
        {histLoading ? (
          <div className="wl-chart-loading">Loading…</div>
        ) : (
          <PlatformChart data={history} period={period} height={140} />
        )}
      </div>

      {/* Notes */}
      <div className="wl-section">
        <button className="wl-section-toggle" onClick={() => setNotesOpen(!notesOpen)}>
          <span>📝 Notes</span>
          <span className="wl-section-arrow">{notesOpen ? '▲' : '▼'}</span>
          {saveStatus && <span className="wl-save-status">{saveStatus}</span>}
        </button>
        {notesOpen && (
          <textarea
            className="wl-notes-input"
            value={notes}
            onChange={handleNotesChange}
            placeholder="Add your research notes here…"
            rows={4}
          />
        )}
        {!notesOpen && notes && (
          <div className="wl-notes-preview text-muted" onClick={() => setNotesOpen(true)}>
            {notes.slice(0, 120)}{notes.length > 120 ? '…' : ''}
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="wl-section">
        <button className="wl-section-toggle" onClick={() => setAlertsOpen(!alertsOpen)}>
          <span>🔔 Price Alerts {item.alerts?.length > 0 && `(${item.alerts.length})`}</span>
          <span className="wl-section-arrow">{alertsOpen ? '▲' : '▼'}</span>
        </button>
        {alertsOpen && (
          <div className="wl-alerts-body">
            {(item.alerts ?? []).map((a) => (
              <AlertRow key={a.id} alert={a} onRemove={() => handleRemoveAlert(a.id)} />
            ))}
            <AddAlertForm onAdd={handleAddAlert} currency={item.currency} />
          </div>
        )}
      </div>
    </div>
  );
}
