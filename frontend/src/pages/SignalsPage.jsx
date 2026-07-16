import React, { useState } from 'react';
import Header from '../components/layout/Header.jsx';
import SignalBoard from '../components/signals/SignalBoard.jsx';
import PriceAlertsPanel from '../components/signals/PriceAlertsPanel.jsx';
import { useSignals } from '../hooks/useSignals.js';
import { usePriceAlerts } from '../hooks/usePriceAlerts.js';
import './SignalsPage.css';

export default function SignalsPage() {
  const [tab, setTab] = useState('signals');
  const { signals, isLoading: sigLoading, error: sigError } = useSignals();
  const { triggeredCount } = usePriceAlerts();

  const counts = signals?.counts ?? {};
  const total  = (counts.BUY ?? 0) + (counts.SELL ?? 0) + (counts.WATCH ?? 0);

  const subtitle = tab === 'signals'
    ? `${total} active signals · ${counts.BUY ?? 0} buy · ${counts.SELL ?? 0} sell · ${counts.WATCH ?? 0} watch`
    : triggeredCount > 0
      ? `${triggeredCount} alert${triggeredCount !== 1 ? 's' : ''} triggered`
      : 'Monitor your price targets';

  return (
    <div className="signals-page">
      <Header title="Signals" subtitle={subtitle} />

      {/* Tab bar */}
      <div className="sp-tab-bar">
        <button
          className={`sp-tab ${tab === 'signals' ? 'sp-tab--active' : ''}`}
          onClick={() => setTab('signals')}
        >
          <span className="sp-tab-icon">◎</span>
          AI Signals
          <span className="sp-tab-count">{total}</span>
        </button>
        <button
          className={`sp-tab ${tab === 'alerts' ? 'sp-tab--active' : ''}`}
          onClick={() => setTab('alerts')}
        >
          <span className="sp-tab-icon">◐</span>
          Price Alerts
          {triggeredCount > 0 ? (
            <span className="sp-tab-badge">{triggeredCount}</span>
          ) : null}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'signals' && (
        <>
          {sigLoading && <div className="loading" style={{ padding: '48px 32px' }}>Loading signals…</div>}
          {sigError   && <div className="error-msg" style={{ margin: '24px 32px' }}>Failed to load signals.</div>}
          {!sigLoading && !sigError && <SignalBoard signals={signals} />}
        </>
      )}

      {tab === 'alerts' && <PriceAlertsPanel />}
    </div>
  );
}
