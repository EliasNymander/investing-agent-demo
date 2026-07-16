import React, { useState } from 'react';
import Header from '../components/layout/Header.jsx';
import { useAlerts } from '../hooks/useAlerts.js';

const CONFIDENCE_COLOR = { high: 'var(--green)', medium: 'var(--yellow)', low: 'var(--red)' };
const SOURCE_LABEL = { claude: 'Claude', phi: 'Phi-3.5', mock: 'Mock', hardcoded: 'Offline' };
const SOURCE_COLOR = { claude: 'var(--accent)', phi: 'var(--text-secondary)', mock: 'var(--yellow)', hardcoded: 'var(--red)' };

async function triggerBriefing(setGenerating, setError, mutate) {
  setGenerating(true);
  setError(null);
  try {
    const res = await fetch('/api/scheduler/trigger?type=daily', { method: 'POST' });
    if (!res.ok) { setError(`Generation failed (${res.status}) — try again.`); return; }
    await mutate();
  } finally {
    setGenerating(false);
  }
}

export default function AlertsPage() {
  const { alerts, isLoading, error, mutate } = useAlerts();
  const [generating, setGenerating] = useState(false);
  const [triggerError, setTriggerError] = useState(null);

  if (isLoading) return <div className="loading">Loading daily briefing…</div>;
  if (error) return <div className="error-msg">Failed to load briefing.</div>;

  if (alerts?.notGenerated) {
    return (
      <div>
        <Header title="Daily Alert Briefing" subtitle="No briefing generated yet" />
        <div style={{ padding: '64px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h2 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>No briefing yet today</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            Generate an AI daily briefing to see portfolio insights, signal updates, and risk flags.
          </p>
          <button
            onClick={() => triggerBriefing(setGenerating, setTriggerError, mutate)}
            disabled={generating}
            style={{
              padding: '10px 24px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? 'Generating…' : 'Generate Now'}
          </button>
          {triggerError && (
            <p style={{ marginTop: 12, color: 'var(--red)', fontSize: 13 }}>{triggerError}</p>
          )}
        </div>
      </div>
    );
  }

  const d = alerts ?? {};
  const genDate = d.generatedAt ? new Date(d.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const ageH = d.generatedAt
    ? (Date.now() - new Date(d.generatedAt).getTime()) / 3600000
    : null;
  const isStale = ageH != null && ageH > 24;

  return (
    <div>
      <Header
        title="Daily Alert Briefing"
        subtitle={`${genDate}${d.confidence ? ` · Confidence: ${d.confidence}` : ''}`}
      />
      {d.source && (
        <div style={{ padding: '4px 32px 0', fontSize: 11, color: SOURCE_COLOR[d.source] ?? 'var(--text-tertiary)', fontWeight: 600 }}>
          Source: {SOURCE_LABEL[d.source] ?? d.source}
        </div>
      )}
      {isStale && (
        <div style={{ padding: '4px 32px', fontSize: 12, color: 'var(--yellow)', fontWeight: 600 }}>
          ⚠ Briefing is {Math.floor(ageH)}h old — regenerate for fresh analysis.
        </div>
      )}
      <div style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>

        {/* Headline */}
        {d.headline && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
              Top Headline
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{d.headline}</div>
            {d.confidence && (
              <div style={{ marginTop: 8, fontSize: 12, color: CONFIDENCE_COLOR[d.confidence] ?? 'var(--text-secondary)', fontWeight: 600 }}>
                Confidence: {d.confidence.toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Key Insights */}
        {d.keyInsights?.length > 0 && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Key Insights</div>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.keyInsights.map((insight, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{insight}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Top News Analysis */}
        {d.topNewsAnalysis && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Market Analysis</div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{d.topNewsAnalysis}</p>
          </div>
        )}

        {/* Signal Updates */}
        {d.signalUpdates?.length > 0 && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Signal Updates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.signalUpdates.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', background: s.action === 'buy' ? 'rgba(34,197,94,0.15)' : s.action === 'sell' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                    color: s.action === 'buy' ? 'var(--green)' : s.action === 'sell' ? 'var(--red)' : 'var(--yellow)',
                    flexShrink: 0,
                  }}>
                    {s.action}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{s.ticker}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{s.reasoning}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items + Risk Flags side by side */}
        {(d.actionItems?.length > 0 || d.riskFlags?.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {d.actionItems?.length > 0 && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <div className="section-title" style={{ marginBottom: 10 }}>Action Items</div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {d.actionItems.map((item, i) => (
                    <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: 13 }}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {d.riskFlags?.length > 0 && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <div className="section-title" style={{ marginBottom: 10, color: 'var(--red)' }}>Risk Flags</div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {d.riskFlags.map((flag, i) => (
                    <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: 13 }}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Regenerate button */}
        <div style={{ paddingBottom: 32 }}>
          <button
            onClick={() => triggerBriefing(setGenerating, setTriggerError, mutate)}
            disabled={generating}
            style={{
              padding: '8px 18px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            {generating ? 'Generating…' : 'Regenerate Briefing'}
          </button>
          {triggerError && (
            <p style={{ marginTop: 8, color: 'var(--red)', fontSize: 13 }}>{triggerError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
