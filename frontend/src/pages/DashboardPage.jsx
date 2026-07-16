import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header.jsx';
import NetWorthHero from '../components/dashboard/NetWorthHero.jsx';
import TodayPanel from '../components/dashboard/TodayPanel.jsx';
import SummaryCards from '../components/dashboard/SummaryCards.jsx';
import PlatformSection from '../components/dashboard/PlatformSection.jsx';
import { usePortfolio } from '../hooks/usePortfolio.js';
import { TimestampProvider } from '../hooks/TimestampContext.jsx';
import './DashboardPage.css';

export default function DashboardPage() {
  const { portfolio, isLoading, error, mutate } = usePortfolio();
  const fetchedAt = useMemo(
    () => portfolio?.summary?.generatedAt ? new Date(portfolio.summary.generatedAt).getTime() : Date.now(),
    [portfolio?.summary?.generatedAt]
  );

  if (isLoading) return (
    <div>
      <Header title="Portfolio Dashboard" subtitle="Loading…" />
      <div className="db-skeleton-block db-skeleton-hero" />
      <div className="db-skeleton-cards">
        {[0,1,2,3].map(i => <div key={i} className="db-skeleton-block db-skeleton-card" />)}
      </div>
      <div className="db-skeleton-block db-skeleton-table" />
    </div>
  );
  if (error) return (
    <div>
      <Header title="Portfolio Dashboard" subtitle="Error" />
      <div style={{ padding: '64px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ marginBottom: 8, color: 'var(--text)' }}>Failed to load portfolio</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          Could not reach the backend. Make sure the server is running.
        </p>
        <button
          onClick={() => mutate()}
          style={{
            padding: '10px 24px',
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );

  if (portfolio?.isEmpty) {
    const noPrices = portfolio.hasConfiguredHoldings;
    return (
      <div>
        <Header
          title="Portfolio Dashboard"
          subtitle={noPrices ? 'Price data unavailable' : 'No holdings configured'}
        />
        <div style={{ padding: '64px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{noPrices ? '⚠️' : '📊'}</div>
          <h2 style={{ marginBottom: 8, color: 'var(--text)' }}>
            {noPrices ? 'Price data unavailable' : 'No holdings configured yet'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
            {noPrices
              ? 'Your holdings are configured but no live prices could be resolved. Check your API keys in Settings or try refreshing.'
              : 'Add your investments in Settings to see live prices, net worth, and today\'s P&L.'}
          </p>
          <Link
            to="/settings"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: 'var(--accent)',
              color: '#000',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            {noPrices ? 'Open Settings' : 'Go to Settings'}
          </Link>
        </div>
      </div>
    );
  }

  const flagged = portfolio?.flaggedHoldings ?? [];
  const enrichedCount = portfolio?.summary?.holdingCount ?? 0;
  const configuredCount = portfolio?.configuredCount ?? enrichedCount;
  const missingPriceCount = configuredCount - enrichedCount;

  return (
    <TimestampProvider fetchedAt={fetchedAt}>
      <div>
        <Header
          title="Portfolio Dashboard"
          subtitle={`${enrichedCount} positions across 3 platforms${flagged.length ? ` · ${flagged.length} flagged today` : ''}`}
        />

        <NetWorthHero portfolio={portfolio} onRefreshAll={mutate} fetchedAt={fetchedAt} />

        <div className="db-top-row">
          <TodayPanel portfolio={portfolio} fetchedAt={fetchedAt} onRefresh={mutate} />
        </div>

        <SummaryCards summary={portfolio?.summary} fetchedAt={fetchedAt} onRefresh={mutate} />
        {flagged.length > 0 && (
          <div style={{ padding: '0 32px', marginBottom: 16 }}>
            <div className="section-title" style={{ color: 'var(--yellow)' }}>
              ⚡ {flagged.length} position{flagged.length > 1 ? 's' : ''} breached move threshold today
              {' — '}
              {flagged.map((h, i) => (
                <span key={h.ticker}>
                  {i > 0 && ', '}
                  <span style={{ fontWeight: 600 }}>{h.ticker}</span>
                  {h.dailyPct != null && (
                    <span style={{ fontWeight: 400, marginLeft: 2 }}>
                      ({h.dailyPct >= 0 ? '+' : ''}{h.dailyPct.toFixed(1)}%)
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
        <PlatformSection platform="nordnet" holdings={portfolio?.platforms.nordnet} fetchedAt={fetchedAt} onRefresh={mutate} warning={portfolio?.stockMeta?.warning} />
        <PlatformSection platform="nordea" holdings={portfolio?.platforms.nordea} fetchedAt={fetchedAt} onRefresh={mutate} />
        <PlatformSection platform="kvarnx" holdings={portfolio?.platforms.kvarnx} fetchedAt={fetchedAt} onRefresh={mutate} cryptoMeta={portfolio?.cryptoMeta} />
        {missingPriceCount > 0 && (
          <div style={{ padding: '8px 32px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
            Showing {enrichedCount} of {configuredCount} holdings — {missingPriceCount} have no price source yet
          </div>
        )}
      </div>
    </TimestampProvider>
  );
}
