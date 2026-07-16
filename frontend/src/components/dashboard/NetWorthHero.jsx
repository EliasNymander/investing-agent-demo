import React, { useState } from 'react';
import PanelTimestamp from './PanelTimestamp.jsx';
import './NetWorthHero.css';

function fmtEur(n, showSign = false) {
  if (n == null) return '—';
  const sign = showSign ? (n >= 0 ? '+' : '-') : '';
  return `${sign}€${Math.abs(n).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n) {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

// Compute today's EUR gain for a platform's holdings array
function platformDayPl(holdings) {
  if (!holdings?.length) return 0;
  return holdings.reduce((sum, h) => {
    // Approximation: dayGainEur ≈ marketValueEur * dailyPct/100 (accurate for small moves)
    return sum + (h.marketValueEur * (h.dailyPct ?? 0)) / 100;
  }, 0);
}

export default function NetWorthHero({ portfolio, onRefreshAll, fetchedAt }) {
  const [spinning, setSpinning] = useState(false);

  // ── Derive values from live portfolio data ─────────────────────────────────
  const nordnetValue = portfolio?.platforms?.nordnet?.reduce((s, h) => s + h.marketValueEur, 0) ?? 0;
  const nordeaValue  = portfolio?.platforms?.nordea?.reduce((s, h) => s + h.marketValueEur, 0) ?? 0;
  const kvarnxValue  = portfolio?.platforms?.kvarnx?.reduce((s, h) => s + h.marketValueEur, 0) ?? 0;
  const total        = portfolio?.summary?.totalValueEur ?? 0;
  const dayPl        = portfolio?.summary?.dayPlEur ?? 0;
  const dayPlPct     = total > 0 ? (dayPl / (total - dayPl)) * 100 : 0;

  const isPos = dayPl >= 0;

  function handleRefreshAll() {
    setSpinning(true);
    onRefreshAll?.();
    setTimeout(() => setSpinning(false), 1000);
  }

  return (
    <div className="nw-hero">
      <div className="nw-hero-body">

        {/* Left — big number + breakdown */}
        <div className="nw-main">
          <div className="nw-label">Total Net Worth</div>
          <div className="nw-total">{fmtEur(total)}</div>
          <div className="nw-platforms">
            <span className="nw-platform-item">
              <span className="nw-platform-name">Nordnet</span>
              <span className="nw-platform-value">{fmtEur(nordnetValue)}</span>
            </span>
            <span className="nw-platform-sep">·</span>
            <span className="nw-platform-item">
              <span className="nw-platform-name">Nordea</span>
              <span className="nw-platform-value">{fmtEur(nordeaValue)}</span>
            </span>
            <span className="nw-platform-sep">·</span>
            <span className="nw-platform-item">
              <span className="nw-platform-name">KvarnX</span>
              <span className="nw-platform-value">{fmtEur(kvarnxValue)}</span>
            </span>
          </div>
        </div>

        {/* Right — today's change + refresh */}
        <div className="nw-right">
          <div className={`nw-change ${isPos ? 'nw-change--pos' : 'nw-change--neg'}`}>
            <span className="nw-change-indicator">{isPos ? '▲' : '▼'}</span>
            <div className="nw-change-figures">
              <span className="nw-change-eur">{fmtEur(dayPl, true)}</span>
              <span className="nw-change-pct">{fmtPct(dayPlPct)} today</span>
            </div>
          </div>
          <button
            className={`nw-refresh-btn ${spinning ? 'nw-refresh-btn--spinning' : ''}`}
            onClick={handleRefreshAll}
            title="Refresh all panels"
          >
            <span className="nw-refresh-icon">⟳</span>
            Refresh all
          </button>
          {fetchedAt && (
            <PanelTimestamp fetchedAt={fetchedAt} />
          )}
        </div>

      </div>
    </div>
  );
}
