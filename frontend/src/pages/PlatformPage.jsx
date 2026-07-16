import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio.js';
import { usePlatformHistory } from '../hooks/useHistory.js';
import PlatformChart from '../components/platform/PlatformChart.jsx';
import PeriodSelector from '../components/platform/PeriodSelector.jsx';
import HoldingChart from '../components/platform/HoldingChart.jsx';
import './PlatformPage.css';

const PLATFORM_META = {
  nordnet: { label: 'Nordnet', subtitle: 'Stocks & ETFs', icon: '◈' },
  nordea:  { label: 'Nordea',  subtitle: 'Investment Funds', icon: '▤' },
  kvarnx:  { label: 'KvarnX', subtitle: 'Crypto', icon: '◎' },
};

function fmt(n) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
}

function PeriodStats({ data }) {
  if (!data || data.length < 2) return null;
  const start = data[0].value;
  const end = data[data.length - 1].value;
  const change = end - start;
  const changePct = (change / start) * 100;
  const isPos = change >= 0;

  return (
    <div className="platform-period-stats">
      <span className="platform-current-val">{fmt(end)}</span>
      <span className={`platform-period-change text-mono ${isPos ? 'text-green' : 'text-red'}`}>
        {isPos ? '+' : ''}{fmt(change)} ({isPos ? '+' : ''}{changePct.toFixed(2)}%)
      </span>
    </div>
  );
}

export default function PlatformPage() {
  const { platformId } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('1M');

  const { portfolio, isLoading: portLoading } = usePortfolio();
  const { history, isLoading: histLoading } = usePlatformHistory(platformId, period);

  const meta = PLATFORM_META[platformId] ?? { label: platformId, subtitle: '', icon: '◈' };
  const holdings = portfolio?.platforms?.[platformId] ?? [];

  const platformSummary = useMemo(() => {
    if (!holdings.length) return null;
    const totalValue = holdings.reduce((s, h) => s + h.marketValueEur, 0);
    const totalCost = holdings.reduce((s, h) => s + h.costBasisEur, 0);
    const totalPl = totalValue - totalCost;
    const totalPlPct = (totalPl / totalCost) * 100;
    return { totalValue, totalPl, totalPlPct };
  }, [holdings]);

  if (portLoading) return <div className="loading">Loading platform data…</div>;

  return (
    <div className="platform-page">
      {/* Header */}
      <div className="platform-page-header">
        <button className="platform-back-btn" onClick={() => navigate('/')}>
          ← Dashboard
        </button>
        <div className="platform-page-title-row">
          <div>
            <h1 className="platform-page-title">
              <span className="platform-page-icon">{meta.icon}</span>
              {meta.label}
            </h1>
            <p className="platform-page-subtitle">{meta.subtitle}</p>
          </div>
          {platformSummary && (
            <div className="platform-page-summary">
              <div className="platform-summary-item">
                <span className="platform-summary-label">Total Value</span>
                <span className="platform-summary-value text-mono">{fmt(platformSummary.totalValue)}</span>
              </div>
              <div className="platform-summary-item">
                <span className="platform-summary-label">All-time P&L</span>
                <span className={`platform-summary-value text-mono ${platformSummary.totalPl >= 0 ? 'text-green' : 'text-red'}`}>
                  {platformSummary.totalPl >= 0 ? '+' : ''}{fmt(platformSummary.totalPl)}
                  <span className="text-small"> ({platformSummary.totalPl >= 0 ? '+' : ''}{platformSummary.totalPlPct.toFixed(2)}%)</span>
                </span>
              </div>
              <div className="platform-summary-item">
                <span className="platform-summary-label">Positions</span>
                <span className="platform-summary-value text-mono">{holdings.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Total portfolio chart */}
      <div className="platform-total-chart-section">
        <div className="platform-chart-toolbar">
          <div>
            <div className="section-title" style={{ marginBottom: 4 }}>
              Portfolio Value — {meta.label}
            </div>
            {!histLoading && <PeriodStats data={history} />}
          </div>
          <PeriodSelector selected={period} onChange={setPeriod} />
        </div>
        <div className="platform-chart-body">
          {histLoading ? (
            <div className="loading" style={{ height: 260 }}>Loading chart…</div>
          ) : (
            <PlatformChart data={history} period={period} height={260} />
          )}
        </div>
      </div>

      {/* Per-holding charts */}
      <div className="platform-holdings-section">
        <div className="platform-holdings-header">
          <span className="section-title">Individual Holdings</span>
          <PeriodSelector selected={period} onChange={setPeriod} />
        </div>

        {platformId === 'kvarnx' && (
          <div className="coingecko-attribution">
            Price data by{' '}
            <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer">
              CoinGecko
            </a>{' '}
            (mock data in Phase 1)
          </div>
        )}

        <div className="platform-holdings-grid">
          {holdings.map((h) => (
            <HoldingChart key={h.ticker} holding={h} period={period} />
          ))}
        </div>
      </div>
    </div>
  );
}
