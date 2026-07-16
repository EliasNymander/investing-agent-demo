import React, { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HoldingRow from './HoldingRow.jsx';
import PanelTimestamp from './PanelTimestamp.jsx';
import './PlatformSection.css';

const PLATFORM_LABELS = {
  nordnet: 'Nordnet — Stocks, ETFs & Funds',
  nordea:  'Nordea — Investment Funds',
  kvarnx:  'KvarnX — Crypto',
};

const PLATFORM_SUBTITLES = {
  nordea: 'NAV-based pricing. Execution takes 1–3 business days.',
};

const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

function CoinGeckoAttribution() {
  return (
    <span className="coingecko-attribution">
      <img src="/coingecko-logo.svg" alt="" className="coingecko-logo" />
      Price data by{' '}
      <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer">
        CoinGecko
      </a>
    </span>
  );
}

export default function PlatformSection({ platform, holdings, fetchedAt, onRefresh, cryptoMeta, warning }) {
  const navigate = useNavigate();
  const isCrypto = platform === 'kvarnx';

  // Track last manual refresh time for 15-min cooldown (crypto only)
  const lastRefreshRef = useRef(null);
  const [cooldownMsg, setCooldownMsg] = useState(null);

  const handleRefresh = useCallback(() => {
    if (!isCrypto) { onRefresh?.(); return; }

    const now = Date.now();
    const cacheAgeMin = cryptoMeta?.cacheAgeMin ?? 999;
    const msSinceLastRefresh = lastRefreshRef.current ? now - lastRefreshRef.current : Infinity;

    // Block if cache is still fresh (< 15 min) OR cooldown hasn't elapsed
    if (cacheAgeMin < 15 || msSinceLastRefresh < COOLDOWN_MS) {
      const age = cacheAgeMin != null ? `${cacheAgeMin} min ago` : 'recently';
      setCooldownMsg(`Data is up to date — last updated ${age}`);
      setTimeout(() => setCooldownMsg(null), 4000);
      return;
    }

    lastRefreshRef.current = now;
    setCooldownMsg(null);
    onRefresh?.();
  }, [isCrypto, cryptoMeta, onRefresh]);

  if (!holdings || holdings.length === 0) return null;

  const totalEur = holdings.reduce((s, h) => s + h.marketValueEur, 0);
  const totalPl  = holdings.reduce((s, h) => s + h.plAbsEur, 0);
  const label    = PLATFORM_LABELS[platform] ?? platform;
  const subtitle = PLATFORM_SUBTITLES[platform];

  return (
    <div className="platform-section">
      <div
        className="platform-header"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`/platform/${platform}`)}
      >
        <div>
          <span className="platform-title">{label}</span>
          <span className="platform-drill-hint">View charts →</span>
          {subtitle && <span className="platform-subtitle">{subtitle}</span>}
          {isCrypto && <CoinGeckoAttribution />}
        </div>
        <div className="platform-totals">
          <span className="text-mono">
            {new Intl.NumberFormat('en-IE', {
              style: 'currency', currency: 'EUR', minimumFractionDigits: 0,
            }).format(totalEur)}
          </span>
          <span className={`text-mono text-small ${totalPl >= 0 ? 'text-green' : 'text-red'}`}>
            {totalPl >= 0 ? '+' : ''}
            {new Intl.NumberFormat('en-IE', {
              style: 'currency', currency: 'EUR', minimumFractionDigits: 0,
            }).format(totalPl)}
          </span>
          {fetchedAt && (
            <PanelTimestamp fetchedAt={fetchedAt} onRefresh={handleRefresh} />
          )}
        </div>
      </div>

      {/* Cooldown toast */}
      {cooldownMsg && (
        <div className="crypto-cooldown-msg" onClick={(e) => e.stopPropagation()}>
          {cooldownMsg}
        </div>
      )}

      {/* Cache / limit warning — crypto or stock data issues */}
      {(isCrypto ? cryptoMeta?.warning : warning) && (
        <div className="crypto-cache-warning" onClick={(e) => e.stopPropagation()}>
          {isCrypto ? cryptoMeta.warning : warning}
        </div>
      )}

      <table className="holdings-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Avg Cost</th>
            <th className="text-right">Current</th>
            <th className="text-right">Value (EUR)</th>
            <th className="text-right">P&amp;L</th>
            <th className="text-right">Today</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => <HoldingRow key={h.ticker} holding={h} />)}
        </tbody>
      </table>
    </div>
  );
}
