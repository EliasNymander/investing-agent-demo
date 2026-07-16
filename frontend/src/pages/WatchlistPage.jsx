import React, { useState } from 'react';
import Header from '../components/layout/Header.jsx';
import WatchlistCard from '../components/watchlist/WatchlistCard.jsx';
import AddAssetModal from '../components/watchlist/AddAssetModal.jsx';
import { useWatchlist } from '../hooks/useWatchlist.js';
import './WatchlistPage.css';

export default function WatchlistPage() {
  const { items, triggeredCount, isLoading, error, mutate } = useWatchlist();
  const [showAdd, setShowAdd] = useState(false);

  if (isLoading) return <div className="loading">Loading watchlist…</div>;
  if (error) return <div className="error-msg">Failed to load watchlist.</div>;

  const triggered = items.filter((i) => i.hasTriggeredAlerts);
  const normal = items.filter((i) => !i.hasTriggeredAlerts);

  return (
    <div>
      <Header
        title="Watchlist"
        subtitle={`${items.length} assets tracked${triggeredCount > 0 ? ` · ${triggeredCount} alert${triggeredCount > 1 ? 's' : ''} triggered` : ''}`}
      />

      <div className="watchlist-toolbar">
        {triggeredCount > 0 && (
          <div className="watchlist-alert-banner">
            🔔 {triggeredCount} price alert{triggeredCount > 1 ? 's' : ''} triggered — check highlighted cards below
          </div>
        )}
        <button className="wl-btn wl-btn--primary watchlist-add-btn" onClick={() => setShowAdd(true)}>
          + Add asset
        </button>
      </div>

      {items.length === 0 ? (
        <div className="watchlist-empty">
          <div className="watchlist-empty-icon">◎</div>
          <div className="watchlist-empty-title">Your watchlist is empty</div>
          <div className="watchlist-empty-sub">Add assets you're researching to track their price and set alerts.</div>
          <button className="wl-btn wl-btn--primary" onClick={() => setShowAdd(true)}>+ Add your first asset</button>
        </div>
      ) : (
        <div className="watchlist-content">
          {triggered.length > 0 && (
            <div className="watchlist-section">
              <div className="section-title" style={{ color: 'var(--red)', padding: '0 32px' }}>
                🔔 Triggered Alerts
              </div>
              <div className="watchlist-grid">
                {triggered.map((item) => (
                  <WatchlistCard key={item.id} item={item} onMutate={mutate} />
                ))}
              </div>
            </div>
          )}

          {normal.length > 0 && (
            <div className="watchlist-section">
              {triggered.length > 0 && (
                <div className="section-title" style={{ padding: '0 32px' }}>Watching</div>
              )}
              <div className="watchlist-grid">
                {normal.map((item) => (
                  <WatchlistCard key={item.id} item={item} onMutate={mutate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddAssetModal
          onClose={() => setShowAdd(false)}
          onAdded={() => mutate()}
        />
      )}
    </div>
  );
}
