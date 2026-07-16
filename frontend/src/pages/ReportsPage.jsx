import React, { useState } from 'react';
import Header from '../components/layout/Header.jsx';
import { useReports } from '../hooks/useReports.js';
import './ReportsPage.css';

const CONFIDENCE_COLOR = { high: 'var(--green)', medium: 'var(--yellow)', low: 'var(--red)' };
const ACTION_COLOR = { buy: 'var(--green)', sell: 'var(--red)', watch: 'var(--yellow)', hold: 'var(--text-secondary)' };
const ACTION_BG = { buy: 'rgba(34,197,94,0.15)', sell: 'rgba(239,68,68,0.15)', watch: 'rgba(234,179,8,0.15)', hold: 'rgba(148,163,184,0.12)' };
const SOURCE_LABEL = { claude: 'Claude', phi: 'Phi-3.5', mock: 'Mock', hardcoded: 'Offline' };
const SOURCE_COLOR = { claude: 'var(--accent)', phi: 'var(--text-secondary)', mock: 'var(--yellow)', hardcoded: 'var(--red)' };

function Section({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="report-section">
      <button className="report-section-toggle" onClick={() => setOpen(!open)}>
        <span>{open ? '▼' : '▶'}</span>
        <span>{title}</span>
      </button>
      {open && <div className="report-section-body">{children}</div>}
    </div>
  );
}

async function triggerReport(setGenerating, setError, mutate) {
  setGenerating(true);
  setError(null);
  try {
    const res = await fetch('/api/scheduler/trigger?type=weekly', { method: 'POST' });
    if (!res.ok) { setError(`Generation failed (${res.status}) — try again.`); return; }
    await mutate();
  } finally {
    setGenerating(false);
  }
}

export default function ReportsPage() {
  const { report, isLoading, error, mutate } = useReports();
  const [generating, setGenerating] = useState(false);
  const [triggerError, setTriggerError] = useState(null);

  if (isLoading) return <div className="loading">Loading weekly report…</div>;
  if (error) return <div className="error-msg">Failed to load weekly report.</div>;

  if (report?.notGenerated) {
    return (
      <div>
        <Header title="Weekly Deep Dive" subtitle="No report generated yet" />
        <div style={{ padding: '64px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h2 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>No weekly report yet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            Generate a weekly AI portfolio review with signals, opportunities, and risk analysis.
          </p>
          <button
            onClick={() => triggerReport(setGenerating, setTriggerError, mutate)}
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

  const r = report ?? {};
  const genDate = r.generatedAt
    ? new Date(r.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const ageH = r.generatedAt
    ? (Date.now() - new Date(r.generatedAt).getTime()) / 3600000
    : null;
  const isStale = ageH != null && ageH > 168;

  return (
    <div>
      <Header
        title="Weekly Deep Dive"
        subtitle={`${genDate}${r.confidence ? ` · Confidence: ${r.confidence}` : ''}`}
      />
      {r.source && (
        <div style={{ padding: '4px 32px 0', fontSize: 11, color: SOURCE_COLOR[r.source] ?? 'var(--text-tertiary)', fontWeight: 600 }}>
          Source: {SOURCE_LABEL[r.source] ?? r.source}
        </div>
      )}
      {isStale && (
        <div style={{ padding: '4px 32px', fontSize: 12, color: 'var(--yellow)', fontWeight: 600 }}>
          ⚠ Report is {Math.floor(ageH / 24)}d old — regenerate for a fresh weekly review.
        </div>
      )}
      <div style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Headline + Analysis */}
        {(r.headline || r.analysis) && (
          <Section title="Weekly Summary">
            <div style={{ padding: '16px 20px' }}>
              {r.headline && (
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.4 }}>
                  {r.headline}
                </div>
              )}
              {r.confidence && (
                <div style={{ fontSize: 12, fontWeight: 600, color: CONFIDENCE_COLOR[r.confidence], marginBottom: 12 }}>
                  Confidence: {r.confidence.toUpperCase()}
                </div>
              )}
              {r.analysis && (
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{r.analysis}</p>
              )}
            </div>
          </Section>
        )}

        {/* Portfolio Signals */}
        {r.signals?.length > 0 && (
          <Section title="Portfolio Signals">
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {r.signals.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', flexShrink: 0,
                    background: ACTION_BG[s.action] ?? 'transparent',
                    color: ACTION_COLOR[s.action] ?? 'var(--text-secondary)',
                  }}>
                    {s.action}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0, minWidth: 60 }}>{s.ticker}</span>
                  {s.timeHorizon && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, paddingTop: 2 }}>
                      [{s.timeHorizon}]
                    </span>
                  )}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{s.reasoning}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Opportunities */}
        {r.opportunities?.length > 0 && (
          <Section title="Scouted Opportunities">
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.opportunities.map((opp, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>→</span>
                  <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{opp}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Risk Flags */}
        {r.riskFlags?.length > 0 && (
          <Section title="Risk Flags">
            <div style={{ padding: '16px 20px' }}>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.riskFlags.map((flag, i) => (
                  <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{flag}</li>
                ))}
              </ul>
            </div>
          </Section>
        )}

        {/* Regenerate */}
        <div style={{ paddingBottom: 32 }}>
          <button
            onClick={() => triggerReport(setGenerating, setTriggerError, mutate)}
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
            {generating ? 'Generating…' : 'Regenerate Report'}
          </button>
          {triggerError && (
            <p style={{ marginTop: 8, color: 'var(--red)', fontSize: 13 }}>{triggerError}</p>
          )}
        </div>

      </div>
    </div>
  );
}
