import React, { useState } from 'react';
import { useLastUpdated } from '../../hooks/useLastUpdated.js';
import { useTimestamp } from '../../hooks/TimestampContext.jsx';
import './PanelTimestamp.css';

export default function PanelTimestamp({ fetchedAt, onRefresh }) {
  const ctx = useTimestamp();
  const local = useLastUpdated(ctx ? null : fetchedAt);
  const { label, staleness } = ctx ?? local;
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    onRefresh?.();
    setTimeout(() => setSpinning(false), 900);
  }

  const staleMsg =
    staleness === 'stale' ? '⚠ Data is outdated — please refresh' :
    staleness === 'warn'  ? '⚠ Data may be outdated — refresh to update' :
    null;

  return (
    <div className={`pts-wrap pts-wrap--${staleness}`}>
      {staleMsg && <span className="pts-stale-msg">{staleMsg}</span>}
      <span className="pts-label">{label}</span>
      <button
        className={`pts-btn ${spinning ? 'pts-btn--spinning' : ''}`}
        onClick={handleRefresh}
        title="Refresh this panel"
        aria-label="Refresh"
      >
        ⟳
      </button>
    </div>
  );
}
