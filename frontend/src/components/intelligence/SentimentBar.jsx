import React from 'react';
import './SentimentBar.css';

export default function SentimentBar({ stats }) {
  if (!stats) return null;

  return (
    <div className="sentiment-bar">
      <span className="sentiment-bar-label">Today's portfolio sentiment</span>

      <div className="sentiment-pills">
        <span className="sentiment-pill sentiment-pill--bullish">
          <span className="sentiment-dot" />
          {stats.bullishPct}% Bullish
        </span>
        <span className="sentiment-pill sentiment-pill--bearish">
          <span className="sentiment-dot" />
          {stats.bearishPct}% Bearish
        </span>
        <span className="sentiment-pill sentiment-pill--neutral">
          <span className="sentiment-dot" />
          {stats.neutralPct}% Neutral
        </span>
      </div>

      <div className="sentiment-track">
        {stats.bullishPct  > 0 && <div className="sentiment-fill sentiment-fill--bullish"  style={{ width: `${stats.bullishPct}%`  }} />}
        {stats.bearishPct  > 0 && <div className="sentiment-fill sentiment-fill--bearish"  style={{ width: `${stats.bearishPct}%`  }} />}
        {stats.neutralPct  > 0 && <div className="sentiment-fill sentiment-fill--neutral"  style={{ width: `${stats.neutralPct}%`  }} />}
      </div>

      <span className="sentiment-bar-count">
        Based on {stats.total} article{stats.total !== 1 ? 's' : ''} published today
      </span>
    </div>
  );
}
