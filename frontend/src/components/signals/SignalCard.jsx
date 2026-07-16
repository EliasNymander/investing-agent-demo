import React, { useState } from 'react';
import SignalBadge from './SignalBadge.jsx';
import './SignalCard.css';

const RISK_COLOR = { LOW: 'text-green', MEDIUM: 'text-yellow', HIGH: 'text-red' };

function fmtEur(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n) {
  if (n == null) return '';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export default function SignalCard({ signal }) {
  const [expanded, setExpanded] = useState(false);
  const isCrypto = signal.assetClass === 'crypto';
  const hasLivePrice = isCrypto && signal.livePriceEur != null;

  return (
    <div className={`signal-card signal-card--${signal.type.toLowerCase()}`}>
      <div className="signal-card-header">
        <SignalBadge type={signal.type} />
        <div className="signal-card-meta">
          <span className="signal-ticker">{signal.ticker}</span>
          <span className="signal-platform text-muted">{signal.platform}</span>
        </div>
      </div>

      <div className="signal-name">{signal.name}</div>

      {/* Live price row for crypto signals */}
      {hasLivePrice && (
        <div className="signal-live-price">
          <span className="signal-live-label">Live price</span>
          <span className="signal-live-value text-mono">
            {fmtEur(signal.livePriceEur)}
          </span>
          {signal.liveDailyPct != null && (
            <span className={`signal-live-change text-mono ${signal.liveDailyPct >= 0 ? 'text-green' : 'text-red'}`}>
              {fmtPct(signal.liveDailyPct)} 24h
            </span>
          )}
        </div>
      )}

      {signal.upside && <div className="signal-upside">{signal.upside}</div>}

      {signal.risk && (
        <div className="signal-row">
          <span className="signal-label">Risk</span>
          <span className={`signal-value text-mono ${RISK_COLOR[signal.risk] ?? ''}`}>{signal.risk}</span>
        </div>
      )}
      {signal.timeHorizon && (
        <div className="signal-row">
          <span className="signal-label">Horizon</span>
          <span className="signal-value text-mono">{signal.timeHorizon}</span>
        </div>
      )}
      {signal.trigger && (
        <div className="signal-row">
          <span className="signal-label">Signal</span>
          <span className="signal-value text-mono">{signal.trigger}</span>
        </div>
      )}

      <button className="signal-expand-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▲ Less' : '▼ Full analysis'}
      </button>

      {expanded && (
        <div className="signal-expanded">
          <div className="signal-section-label">Reasoning</div>
          <p className="signal-reasoning">{signal.reasoning}</p>
          {signal.riskNote && (
            <>
              <div className="signal-section-label">Risk Note</div>
              <p className="signal-reasoning text-muted">{signal.riskNote}</p>
            </>
          )}
          {signal.recommendedAction && (
            <>
              <div className="signal-section-label">Recommended Action</div>
              <p className="signal-reasoning">{signal.recommendedAction}</p>
            </>
          )}
        </div>
      )}

      {/* CoinGecko attribution — only on crypto signal cards */}
      {isCrypto && (
        <div className="signal-coingecko-attr">
          <img src="/coingecko-logo.svg" alt="" className="signal-cg-logo" />
          Price data by{' '}
          <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer">
            CoinGecko
          </a>
        </div>
      )}
    </div>
  );
}
