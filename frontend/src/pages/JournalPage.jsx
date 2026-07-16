import React, { useState, useMemo } from 'react';
import Header from '../components/layout/Header.jsx';
import TradeCard from '../components/journal/TradeCard.jsx';
import LogTradeModal from '../components/journal/LogTradeModal.jsx';
import { useJournal } from '../hooks/useJournal.js';
import { addJournalEntry, updateJournalEntry, deleteJournalEntry } from '../api/journal.js';
import './JournalPage.css';

function fmtEur(n) {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return sign + new Intl.NumberFormat('en-IE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

const VIEWS = [
  { key: 'all',    label: 'All' },
  { key: 'buy',    label: 'BUY' },
  { key: 'sell',   label: 'SELL' },
  { key: 'open',   label: 'Open' },
  { key: 'closed', label: 'Closed' },
];

export default function JournalPage() {
  const { entries, stats, isLoading, error, mutate } = useJournal();
  const [view,         setView]         = useState('all');
  const [tickerFilter, setTickerFilter] = useState('all');
  const [modal,        setModal]        = useState(null); // null | 'new' | entry-object

  // Build unique sorted ticker list from all entries
  const tickers = useMemo(() => {
    const seen = new Set();
    (entries ?? []).forEach((e) => seen.add(e.ticker));
    return [...seen].sort();
  }, [entries]);

  // All open BUY entries (for SELL modal linking)
  const openBuys = useMemo(
    () => (entries ?? []).filter((e) => e.action === 'BUY' && e.status === 'open'),
    [entries]
  );

  const filtered = useMemo(() => {
    return (entries ?? []).filter((e) => {
      if (view === 'buy'  && e.action !== 'BUY')  return false;
      if (view === 'sell' && e.action !== 'SELL') return false;
      if (view === 'open' && e.status !== 'open') return false;
      if (view === 'closed' && e.action !== 'SELL') return false;
      if (tickerFilter !== 'all' && e.ticker !== tickerFilter) return false;
      return true;
    });
  }, [entries, view, tickerFilter]);

  const subtitle = stats
    ? `${stats.totalEntries} trades · ${stats.winRate}% win rate · ${fmtEur(stats.totalUnrealizedPnlEur)} unrealized`
    : 'Loading…';

  async function handleSave(payload) {
    if (modal && typeof modal === 'object') {
      // Edit
      await updateJournalEntry(modal.id, payload);
    } else {
      await addJournalEntry(payload);
    }
    await mutate();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this journal entry?')) return;
    await deleteJournalEntry(id);
    await mutate();
  }

  return (
    <div className="journal-page">
      <Header title="Trade Journal" subtitle={subtitle} />

      {/* Stats row */}
      {stats && (
        <div className="journal-stats-row">
          <div className="j-stat-card">
            <div className="j-stat-label">Total Trades</div>
            <div className="j-stat-value">{stats.totalEntries}</div>
            <div className="j-stat-sub">{stats.openPositions} open · {stats.closedTrades} closed</div>
          </div>
          <div className="j-stat-card">
            <div className="j-stat-label">Win Rate</div>
            <div className={`j-stat-value ${stats.winRate >= 50 ? 'val-green' : 'val-red'}`}>
              {stats.winRate}%
            </div>
            <div className="j-stat-sub">
              {stats.closedTrades > 0
                ? `${Math.round(stats.winRate / 100 * stats.closedTrades)}/${stats.closedTrades} closed trades`
                : 'No closed trades yet'}
            </div>
          </div>
          <div className="j-stat-card">
            <div className="j-stat-label">Unrealized P&L</div>
            <div className={`j-stat-value ${stats.totalUnrealizedPnlEur >= 0 ? 'val-green' : 'val-red'}`}>
              {fmtEur(stats.totalUnrealizedPnlEur)}
            </div>
            <div className="j-stat-sub">{stats.openPositions} open positions</div>
          </div>
          <div className="j-stat-card">
            <div className="j-stat-label">Signals Followed</div>
            <div className="j-stat-value">{stats.signalLinkedCount}</div>
            <div className="j-stat-sub">of {stats.totalEntries} entries linked</div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="journal-toolbar">
        <div className="j-filter-pills">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              className={`j-pill ${view === key ? 'j-pill--active' : ''}`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          className="j-ticker-select"
          value={tickerFilter}
          onChange={(e) => setTickerFilter(e.target.value)}
        >
          <option value="all">All Tickers</option>
          {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <button className="j-add-btn" onClick={() => setModal('new')}>
          + Log Trade
        </button>
      </div>

      {/* Entry list */}
      <div className="journal-list">
        {isLoading && (
          <div className="journal-empty">Loading journal…</div>
        )}
        {error && (
          <div className="error-msg" style={{ margin: '24px 32px' }}>Failed to load journal.</div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="journal-empty">
            <div className="journal-empty-icon">◑</div>
            <div className="journal-empty-title">No entries match this filter.</div>
            <div className="journal-empty-sub">
              {entries.length === 0 ? 'Click "+ Log Trade" to record your first trade.' : 'Try a different filter.'}
            </div>
          </div>
        )}
        {!isLoading && filtered.map((entry) => (
          <TradeCard
            key={entry.id}
            entry={entry}
            onEdit={(e) => setModal(e)}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <LogTradeModal
          editEntry={typeof modal === 'object' ? modal : null}
          openBuys={openBuys}
          onClose={() => setModal(null)}
          onSaved={handleSave}
        />
      )}
    </div>
  );
}
