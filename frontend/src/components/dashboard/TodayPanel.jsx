import React from 'react';
import PanelTimestamp from './PanelTimestamp.jsx';
import './TodayPanel.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n, showSign = false) {
  if (n == null) return '—';
  const sign = showSign ? (n >= 0 ? '+' : '-') : '';
  return `${sign}€${Math.abs(n).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n, showSign = false) {
  if (n == null) return '—';
  const sign = showSign ? (n >= 0 ? '+' : '-') : '';
  return `${sign}${n.toFixed(2)}%`;
}

// Compute today's EUR P&L for an array of holdings
function platformDayPl(holdings) {
  if (!holdings?.length) return { eur: 0, pct: 0, totalValue: 0 };
  const eur = holdings.reduce((sum, h) => {
    return sum + (h.marketValueEur * (h.dailyPct ?? 0)) / 100;
  }, 0);
  const totalValue = holdings.reduce((s, h) => s + h.marketValueEur, 0);
  const prevValue  = totalValue - eur;
  const pct        = prevValue > 0 ? (eur / prevValue) * 100 : 0;
  return { eur, pct, totalValue };
}

// Find best and worst movers across all holdings (by € gain today)
function findBestWorst(allHoldings) {
  const sorted = [...allHoldings]
    .map((h) => ({
      ticker: h.ticker,
      name:   h.name,
      dayPlEur: (h.marketValueEur * (h.dailyPct ?? 0)) / 100,
      dailyPct: h.dailyPct ?? 0,
    }))
    .sort((a, b) => b.dayPlEur - a.dayPlEur);

  return {
    best:  sorted[0]  ?? null,
    worst: sorted[sorted.length - 1] ?? null,
  };
}

// ── Intraday Direction Bar ─────────────────────────────────────────────────────
// A minimal visual showing portfolio direction: a gradient bar with a marker.
// width 0% = max loss, 50% = flat, 100% = max gain

function DirectionBar({ dayPlEur, totalValueEur }) {
  if (!totalValueEur) return null;
  const pct = totalValueEur > 0 ? (dayPlEur / (totalValueEur - dayPlEur)) * 100 : 0;
  // Clamp to ±3% range for display purposes
  const clamped = Math.max(-3, Math.min(3, pct));
  const position = ((clamped + 3) / 6) * 100; // 0% to 100%
  const isPos = dayPlEur >= 0;

  return (
    <div className="tp-direction-wrap">
      <span className="tp-direction-label">Today</span>
      <div className="tp-direction-track">
        <div className="tp-direction-fill tp-direction-fill--neg" style={{ width: '50%' }} />
        <div className="tp-direction-fill tp-direction-fill--pos" style={{ width: '50%' }} />
        <div
          className={`tp-direction-marker ${isPos ? 'tp-direction-marker--pos' : 'tp-direction-marker--neg'}`}
          style={{ left: `${position}%` }}
        />
        <div className="tp-direction-midline" />
      </div>
      <span className="tp-direction-label">
        {isPos ? 'Up' : 'Down'}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TodayPanel({ portfolio, fetchedAt, onRefresh }) {
  if (!portfolio) return null;

  const allHoldings = [
    ...(portfolio.platforms?.nordnet ?? []),
    ...(portfolio.platforms?.nordea  ?? []),
    ...(portfolio.platforms?.kvarnx  ?? []),
  ];

  const totalDayPl    = portfolio.summary?.dayPlEur ?? 0;
  const totalValueEur = portfolio.summary?.totalValueEur ?? 0;
  const prevValue     = totalValueEur - totalDayPl;
  const totalDayPct   = prevValue > 0 ? (totalDayPl / prevValue) * 100 : 0;

  const nordnet = platformDayPl(portfolio.platforms?.nordnet);
  const nordea  = platformDayPl(portfolio.platforms?.nordea);
  const kvarnx  = platformDayPl(portfolio.platforms?.kvarnx);

  const { best, worst } = findBestWorst(allHoldings);

  const isPos = totalDayPl >= 0;

  return (
    <div className="tp-panel">
      <div className="tp-panel-header">
        <span className="section-title" style={{ marginBottom: 0 }}>Today's Performance</span>
        <DirectionBar dayPlEur={totalDayPl} totalValueEur={totalValueEur} />
      </div>

      {/* Main total */}
      <div className={`tp-total ${isPos ? 'tp-total--pos' : 'tp-total--neg'}`}>
        <span className="tp-total-eur">{fmtEur(totalDayPl, true)}</span>
        <span className="tp-total-pct">{fmtPct(totalDayPct, true)}</span>
      </div>

      {/* Per-platform breakdown */}
      <div className="tp-platforms">
        {[
          { label: 'Nordnet', data: nordnet },
          { label: 'Nordea',  data: nordea  },
          { label: 'KvarnX',  data: kvarnx  },
        ].map(({ label, data }) => (
          <div key={label} className="tp-platform-row">
            <span className="tp-platform-name">{label}</span>
            <span className={`tp-platform-eur ${data.eur >= 0 ? 'tp-pos' : 'tp-neg'}`}>
              {fmtEur(data.eur, true)}
            </span>
            <span className={`tp-platform-pct ${data.eur >= 0 ? 'tp-pos' : 'tp-neg'}`}>
              ({fmtPct(data.pct, true)})
            </span>
          </div>
        ))}
      </div>

      {/* Best / worst movers */}
      <div className="tp-movers">
        {best && (
          <div className="tp-mover tp-mover--best">
            <span className="tp-mover-label">Best</span>
            <span className="tp-mover-ticker">{best.ticker}</span>
            <span className="tp-mover-eur tp-pos">{fmtEur(best.dayPlEur, true)}</span>
          </div>
        )}
        {worst && (
          <div className="tp-mover tp-mover--worst">
            <span className="tp-mover-label">Worst</span>
            <span className="tp-mover-ticker">{worst.ticker}</span>
            <span className="tp-mover-eur tp-neg">{fmtEur(worst.dayPlEur, true)}</span>
          </div>
        )}
      </div>

      {fetchedAt && (
        <div className="tp-footer">
          <PanelTimestamp fetchedAt={fetchedAt} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  );
}
