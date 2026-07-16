import React, { useState } from 'react';
import SignalCard from './SignalCard.jsx';
import './SignalBoard.css';

const FILTERS = ['ALL', 'BUY', 'SELL', 'WATCH'];

function SignalAge({ generatedAt }) {
  if (!generatedAt) return null;
  const ageH = (Date.now() - new Date(generatedAt).getTime()) / 3600000;
  const isStale = ageH > 24;
  const label = ageH < 1
    ? 'Generated less than 1 hour ago'
    : ageH < 48
      ? `Generated ${Math.floor(ageH)}h ago`
      : `Generated ${Math.floor(ageH / 24)}d ago`;
  return (
    <div className={`signal-age${isStale ? ' signal-age--stale' : ''}`}>
      {isStale && <span className="signal-age-icon">⚠ </span>}
      {label}
    </div>
  );
}

export default function SignalBoard({ signals }) {
  const [filter, setFilter] = useState('ALL');
  if (!signals) return null;

  if (!signals.signals || signals.signals.length === 0) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
        <p style={{ margin: 0 }}>No signals available — add holdings in Settings to generate signals.</p>
      </div>
    );
  }

  const filtered = filter === 'ALL'
    ? signals.signals
    : signals.signals.filter((s) => s.type === filter);

  return (
    <div className="signal-board-wrap" style={{ padding: '0 32px' }}>
      <div className="signal-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`signal-filter-btn ${filter === f ? 'active' : ''}`}
          >
            {f}
            {f !== 'ALL' && signals.counts?.[f] != null && (
              <span className="signal-filter-count">{signals.counts[f]}</span>
            )}
          </button>
        ))}
      </div>
      <SignalAge generatedAt={signals.generatedAt} />
      <div className="signal-grid">
        {filtered.map((s) => <SignalCard key={s.id} signal={s} />)}
      </div>
    </div>
  );
}
