import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/layout/Header.jsx';
import SetupWizard from '../components/wizard/SetupWizard.jsx';
import AccountsCard from '../components/settings/AccountsCard.jsx';
import { useActiveAccount } from '../hooks/useAccounts.js';
import { useConfig } from '../context/ConfigContext.jsx';
import { DEMO_MODE } from '../api/demoFetch.js';

export default function SettingsPage() {
  const { config } = useConfig();
  const { activeAccount } = useActiveAccount();
  const [showWizard, setShowWizard] = useState(false);
  const [holdings, setHoldings] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const portfolioCardRef = useRef(null);

  const loadHoldings = useCallback(() => {
    fetch('/api/holdings')
      .then((r) => r.json())
      .then((res) => setHoldings(res.data))
      .catch(() => {});
  }, []);

  const loadDemoStatus = useCallback(() => {
    fetch('/api/demo/status')
      .then((r) => r.json())
      .then((data) => setIsDemoMode(data.isDemoMode))
      .catch(() => {});
  }, []);

  useEffect(() => { loadHoldings(); loadDemoStatus(); }, [loadHoldings, loadDemoStatus]);

  const enableDemoMode = () => {
    setDemoLoading(true);
    fetch('/api/demo/enable', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => { setIsDemoMode(data.isDemoMode); loadHoldings(); })
      .catch(() => {})
      .finally(() => setDemoLoading(false));
  };

  const disableDemoMode = () => {
    setDemoLoading(true);
    fetch('/api/demo/disable', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => { setIsDemoMode(data.isDemoMode); loadHoldings(); })
      .catch(() => {})
      .finally(() => setDemoLoading(false));
  };

  const handleAddHoldings = () => {
    portfolioCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setShowWizard(true), 350);
  };

  if (showWizard) {
    return (
      <SetupWizard accountName={activeAccount?.name} onClose={() => { setShowWizard(false); loadHoldings(); }} />
    );
  }

  const schedule = config?.schedule;
  const totalHoldings = holdings
    ? (holdings.nordnet?.length ?? 0) + (holdings.nordea?.length ?? 0) + (holdings.kvarnx?.length ?? 0)
    : 0;

  // State A: no real holdings and demo mode is off — show welcome prompt
  const isFirstVisit = holdings !== null && totalHoldings === 0 && !isDemoMode;

  const platformList = holdings
    ? [
        holdings.nordnet?.length && 'Nordnet',
        holdings.nordea?.length && 'Nordea',
        holdings.kvarnx?.length && 'KvarnX',
      ].filter(Boolean).join(', ')
    : '';

  return (
    <div>
      <Header title="Settings" subtitle="Manage your portfolio configuration and report schedule" />
      <div style={{ padding: '0 32px', maxWidth: 600 }}>

        <AccountsCard />

        {/* ── State A: Welcome prompt ─────────────────────────────────────── */}
        {isFirstVisit && (
          <div className="card" style={{
            marginBottom: 20,
            border: '1px solid var(--accent, #6366f1)',
            background: 'var(--surface-accent, var(--surface-2))',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              👋 Welcome — choose how to get started
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
              You haven't added any holdings yet. Try the agent with sample data first,
              or jump straight into entering your real investments.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                className="wizard-btn wizard-btn--next"
                onClick={enableDemoMode}
                disabled={demoLoading}
                style={{ fontSize: 13 }}
              >
                {demoLoading ? 'Enabling…' : '🎭 Try Demo Mode'}
              </button>
              <button
                className="wizard-btn wizard-btn--back"
                onClick={handleAddHoldings}
                style={{ fontSize: 13 }}
              >
                ➕ Add My Holdings
              </button>
            </div>
          </div>
        )}

        {/* ── Demo Mode card — always first ──────────────────────────────── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Demo Mode</div>
            {isDemoMode && (
              <span style={{
                background: 'rgba(245,158,11,0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}>
                ● ACTIVE
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            Try the agent with sample data before entering your real investments.
            Enable demo mode to see a fully populated portfolio example.
          </p>
          {!DEMO_MODE && (
            <button
              className={`wizard-btn ${isDemoMode ? 'wizard-btn--back' : 'wizard-btn--next'}`}
              onClick={isDemoMode ? disableDemoMode : enableDemoMode}
              disabled={demoLoading}
              style={{ fontSize: 13 }}
            >
              {demoLoading
                ? (isDemoMode ? 'Exiting…' : 'Enabling…')
                : (isDemoMode ? 'Exit Demo Mode' : 'Enable Demo Mode')}
            </button>
          )}

          {/* Note shown only when demo mode is active */}
          {isDemoMode && (
            <div style={{
              borderTop: '1px solid var(--border)',
              marginTop: 16,
              paddingTop: 14,
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}>
              ℹ Your real holdings form is below. You can configure your actual investments
              at any time — they won't be shown until you exit demo mode.
            </div>
          )}
        </div>

        {/* ── Portfolio card ─────────────────────────────────────────────── */}
        <div ref={portfolioCardRef} className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">Portfolio</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>
            {totalHoldings > 0
              ? `${totalHoldings} positions configured across ${platformList}.`
              : 'No holdings configured yet.'}
          </p>
          {DEMO_MODE ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 12, fontStyle: 'italic' }}>
              Holdings editing is disabled in this demo.
            </p>
          ) : (
            <button
              className="wizard-btn wizard-btn--next"
              onClick={() => setShowWizard(true)}
              style={{ fontSize: 13 }}
            >
              {totalHoldings > 0 ? 'Edit Holdings & Settings' : 'Run Setup Wizard'}
            </button>
          )}
        </div>

        {/* ── Report Schedule card ───────────────────────────────────────── */}
        {schedule && (
          <div className="card">
            <div className="section-title">Report Schedule</div>
            <table style={{ fontSize: 13, width: '100%', marginTop: 8 }}>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--text-muted)', padding: '5px 0', paddingRight: 20 }}>Daily alert</td>
                  <td className="text-mono">{schedule.dailyAlertTime}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', padding: '5px 0', paddingRight: 20 }}>Weekly report</td>
                  <td className="text-mono">{schedule.weeklyReportDay}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', padding: '5px 0', paddingRight: 20 }}>Timezone</td>
                  <td className="text-mono">{schedule.timezone}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
