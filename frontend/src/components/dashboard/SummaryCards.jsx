import React from 'react';
import PanelTimestamp from './PanelTimestamp.jsx';
import './SummaryCards.css';

function fmt(n) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export default function SummaryCards({ summary, fetchedAt, onRefresh }) {
  if (!summary) return null;

  const hasCostBasis = summary.totalCostEur > 0;

  const cards = [
    {
      label: 'Total Portfolio Value',
      value: fmt(summary.totalValueEur),
      sub: `${summary.holdingCount} positions`,
      color: 'neutral',
    },
    {
      label: "Today's P&L",
      value: fmt(summary.dayPlEur),
      sub: null,
      color: summary.dayPlEur >= 0 ? 'green' : 'red',
    },
    {
      label: 'Total Return',
      value: hasCostBasis ? fmtPct(summary.totalPlPct) : '—',
      sub: hasCostBasis
        ? `${summary.totalPlEur >= 0 ? '+' : ''}${fmt(summary.totalPlEur)}`
        : 'Enter avg cost in Settings to see return',
      color: hasCostBasis ? (summary.totalPlPct >= 0 ? 'green' : 'red') : 'neutral',
    },
    {
      label: 'Flagged Today',
      value: summary.flaggedCount,
      sub: '±threshold breached',
      color: summary.flaggedCount > 0 ? 'yellow' : 'neutral',
    },
  ];

  return (
    <div className="summary-cards-wrap">
      <div className="summary-cards">
        {cards.map((c) => (
          <div key={c.label} className={`summary-card summary-card--${c.color}`}>
            <div className="summary-card-label">{c.label}</div>
            <div className="summary-card-value">{c.value}</div>
            {c.sub && <div className="summary-card-sub">{c.sub}</div>}
          </div>
        ))}
      </div>
      {fetchedAt && (
        <div className="summary-cards-footer">
          <PanelTimestamp fetchedAt={fetchedAt} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  );
}
