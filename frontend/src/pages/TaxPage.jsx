import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useActiveAccount } from '../hooks/useAccounts.js';
import Header from '../components/layout/Header.jsx';
import PlatformTable from '../components/tax/PlatformTable.jsx';
import ManualEntryModal from '../components/tax/ManualEntryModal.jsx';
import YearChart from '../components/tax/YearChart.jsx';
import { useTax } from '../hooks/useTax.js';
import { DEMO_MODE } from '../api/demoFetch.js';
import './TaxPage.css';

const BRACKET_1_RATE  = 0.30;
const BRACKET_2_RATE  = 0.34;
const BRACKET_1_LIMIT = 30_000;

function calcTax(netGainEur) {
  if (netGainEur <= 0) return 0;
  if (netGainEur <= BRACKET_1_LIMIT) return +(netGainEur * BRACKET_1_RATE).toFixed(2);
  return +(BRACKET_1_LIMIT * BRACKET_1_RATE + (netGainEur - BRACKET_1_LIMIT) * BRACKET_2_RATE).toFixed(2);
}

const AVAILABLE_YEARS = DEMO_MODE ? [2026] : [2026, 2025, 2024, 2023];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n, alwaysSign = false) {
  if (n == null) return '—';
  const sign = n > 0 && alwaysSign ? '+' : n < 0 ? '-' : '';
  return `${sign}€${Math.abs(n).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function loadManualEntries(accountId, year, platform) {
  try {
    return JSON.parse(localStorage.getItem(`tax-manual-${accountId}-${year}-${platform}`) ?? '[]');
  } catch {
    return [];
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`tax-stat-card ${accent ? 'tax-stat-card--accent' : ''}`}>
      <div className="tax-stat-label">{label}</div>
      <div className={`tax-stat-value ${accent ? 'tax-stat-value--accent' : ''}`}>{value}</div>
      {sub && <div className="tax-stat-sub">{sub}</div>}
    </div>
  );
}

function VeroHelper({ veroFields, year }) {
  const [copied, setCopied] = useState(null);

  function handleCopy(key, text) {
    copyToClipboard(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const fields = [
    {
      key:   'nordnetNordea',
      label: veroFields.nordnetNordea.label,
      section: veroFields.nordnetNordea.section,
      value: veroFields.nordnetNordea.net,
      sub: veroFields.nordnetNordea.autoReported ? '✓ Automatically reported by Nordnet/Nordea' : null,
      autoReported: veroFields.nordnetNordea.autoReported,
    },
    {
      key:   'kvarnx',
      label: veroFields.kvarnx.label,
      section: veroFields.kvarnx.section,
      value: veroFields.kvarnx.net,
      sub: '⚠ Must be entered manually in OmaVero',
      autoReported: false,
    },
    ...(veroFields.carryForward.amount > 0 ? [{
      key:   'carryForward',
      label: veroFields.carryForward.label,
      section: veroFields.carryForward.section,
      value: -veroFields.carryForward.amount,
      sub: veroFields.carryForward.years.map((y) => `${y.year}: €${y.remaining.toLocaleString('fi-FI', { minimumFractionDigits: 2 })}`).join(' · '),
      autoReported: false,
    }] : []),
  ];

  return (
    <div className="vero-helper">
      <div className="vero-helper-title">OmaVero Pre-Fill Helper — {year}</div>
      <div className="vero-helper-sub">Copy these values into your Vero tax return (vero.fi/OmaVero)</div>
      <div className="vero-fields">
        {fields.map((f) => (
          <div key={f.key} className={`vero-field ${f.autoReported ? 'vero-field--auto' : 'vero-field--manual'}`}>
            <div className="vero-field-meta">
              <span className="vero-field-section">{f.section}</span>
              <span className="vero-field-arrow">›</span>
              <span className="vero-field-label">{f.label}</span>
              {f.autoReported && <span className="vero-auto-badge">AUTO</span>}
            </div>
            <div className="vero-field-bottom">
              <span className={`vero-field-value ${f.value >= 0 ? 'vero-val--pos' : 'vero-val--neg'}`}>
                {fmtEur(f.value, true)}
              </span>
              {f.sub && <span className="vero-field-hint">{f.sub}</span>}
              {!f.autoReported && (
                <button
                  className={`vero-copy-btn ${copied === f.key ? 'vero-copy-btn--done' : ''}`}
                  onClick={() => handleCopy(f.key, Math.abs(f.value).toFixed(2))}
                >
                  {copied === f.key ? '✓ Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CarryForwardTracker({ carryForwards, availableCarryForward, taxSaving, year }) {
  const entries = Object.entries(carryForwards)
    .filter(([y]) => parseInt(y) < year)
    .sort(([a], [b]) => parseInt(b) - parseInt(a));

  if (!entries.length) return null;

  return (
    <div className="carry-tracker">
      <div className="carry-tracker-title">Loss Carry-Forward Tracker</div>
      <div className="carry-tracker-sub">
        Finnish TVL §50: capital losses can be carried forward up to 5 years.
      </div>
      <div className="carry-rows">
        {entries.map(([y, cf]) => {
          const pct = cf.original > 0 ? Math.round((cf.used / cf.original) * 100) : 0;
          return (
            <div key={y} className="carry-row">
              <span className="carry-year">{y}</span>
              <span className="carry-original">€{cf.original.toLocaleString('fi-FI', { minimumFractionDigits: 2 })}</span>
              <div className="carry-bar-wrap">
                <div className="carry-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="carry-status">
                {cf.remaining > 0
                  ? <span className="carry-avail">€{cf.remaining.toLocaleString('fi-FI', { minimumFractionDigits: 2 })} available</span>
                  : <span className="carry-used">Exhausted</span>}
              </span>
            </div>
          );
        })}
      </div>
      {availableCarryForward > 0 && (
        <div className="carry-saving">
          Applying €{availableCarryForward.toLocaleString('fi-FI', { minimumFractionDigits: 2 })} carry-forward saves
          <strong> €{taxSaving.toLocaleString('fi-FI', { minimumFractionDigits: 2 })} </strong>
          in tax for {year}.
        </div>
      )}
    </div>
  );
}

function CsvExportBtn({ transactions, platform, year }) {
  function handleExport() {
    const header = 'ID,Asset,Ticker,Type,Sell Date,Qty,Buy Cost (EUR),Sell Price (EUR),Gain/Loss (EUR),Note';
    const rows = transactions.map((t) =>
      [t.id, t.assetName, t.ticker, t.type, t.sellDate, t.qty,
       t.buyCostEur, t.sellPriceEur, t.gainEur, t.note ?? ''].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `tax-${platform.toLowerCase()}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="tax-csv-btn" onClick={handleExport} title={`Export ${platform} ${year} to CSV`}>
      ⬇ CSV
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TaxPage() {
  const [year, setYear]               = useState(2026);
  const [manualModal, setManualModal] = useState(null);
  const [manualEntries, setManualEntries] = useState({ nordnet: [], nordea: [], kvarnx: [] });

  const { activeAccount } = useActiveAccount();
  const accountId = activeAccount?.id ?? 'default';

  const { data, isLoading, error } = useTax(year);

  // Reload manual entries when account or year changes
  useEffect(() => {
    setManualEntries({
      nordnet: loadManualEntries(accountId, year, 'nordnet'),
      nordea:  loadManualEntries(accountId, year, 'nordea'),
      kvarnx:  loadManualEntries(accountId, year, 'kvarnx'),
    });
  }, [accountId, year]);

  const handleYearChange = useCallback((y) => {
    setYear(y);
  }, []);

  const handleManualSaved = useCallback((entry) => {
    const platform = entry.platform;
    setManualEntries((prev) => ({
      ...prev,
      [platform]: [...(prev[platform] ?? []), entry],
    }));
  }, []);

  // Merge API transactions with manual entries
  const mergedTransactions = useMemo(() => {
    if (!data) return { nordnet: [], nordea: [], kvarnx: [] };
    return {
      nordnet: [...data.nordnet.transactions, ...manualEntries.nordnet],
      nordea:  [...data.nordea.transactions,  ...manualEntries.nordea ],
      kvarnx:  [...data.kvarnx.transactions,  ...manualEntries.kvarnx ],
    };
  }, [data, manualEntries]);

  // Recompute platform stats with manual entries included
  function recompute(txs) {
    const gains  = txs.filter((t) => t.gainEur > 0).reduce((s, t) => s + t.gainEur, 0);
    const losses = txs.filter((t) => t.gainEur < 0).reduce((s, t) => s + t.gainEur, 0);
    return { gains: +gains.toFixed(2), losses: +losses.toFixed(2), net: +(gains + losses).toFixed(2) };
  }

  const stats = useMemo(() => {
    if (!data) return null;
    const n = recompute(mergedTransactions.nordnet);
    const d = recompute(mergedTransactions.nordea);
    const k = recompute(mergedTransactions.kvarnx);
    return { nordnet: n, nordea: d, kvarnx: k };
  }, [data, mergedTransactions]);

  const computedSummary = useMemo(() => {
    if (!stats) return null;
    const combinedNet           = +(stats.nordnet.net + stats.nordea.net + stats.kvarnx.net).toFixed(2);
    const availableCarryForward = data?.summary?.availableCarryForward ?? 0;
    const adjustedNet           = +(combinedNet - availableCarryForward).toFixed(2);
    const taxBeforeCarry        = calcTax(combinedNet);
    const taxAfterCarry         = calcTax(Math.max(0, adjustedNet));
    return {
      combinedNet,
      availableCarryForward,
      taxBeforeCarry,
      taxAfterCarry,
      taxSaving: +(taxBeforeCarry - taxAfterCarry).toFixed(2),
      bracket:   combinedNet > BRACKET_1_LIMIT ? 34 : 30,
    };
  }, [stats, data]);

  const subtitle = computedSummary
    ? `${year} · Net ${fmtEur(computedSummary.combinedNet, true)} · Tax estimate ${fmtEur(computedSummary.taxAfterCarry)}`
    : `${year}`;

  return (
    <div className="tax-page">
      <Header title="Tax Summary" subtitle={subtitle} />

      {/* Crypto warning banner */}
      <div className="tax-crypto-banner">
        <span className="tax-crypto-icon">⚠</span>
        <span>
          KvarnX crypto gains and losses are <strong>not automatically reported to Vero</strong>.
          You are responsible for self-reporting these figures.
        </span>
      </div>

      {/* Year selector */}
      <div className="tax-toolbar">
        <div className="tax-year-pills">
          {AVAILABLE_YEARS.map((y) => (
            <button
              key={y}
              className={`tax-year-pill ${year === y ? 'tax-year-pill--active' : ''}`}
              onClick={() => handleYearChange(y)}
            >
              {y}
            </button>
          ))}
        </div>
        <span className="tax-toolbar-hint">Mock data — Phase 2 will pull live transaction history</span>
      </div>

      {isLoading && <div className="loading" style={{ padding: '48px 32px' }}>Loading tax data…</div>}
      {error    && <div className="error-msg" style={{ margin: '24px 32px' }}>Failed to load tax data.</div>}

      {data && stats && computedSummary && (
        <div className="tax-content">

          {/* ── Summary stats ─────────────────────────────────────────────── */}
          <div className="tax-stats-row">
            <StatCard
              label="Total Gain"
              value={fmtEur(computedSummary.combinedNet, true)}
              sub={`${mergedTransactions.nordnet.length + mergedTransactions.nordea.length + mergedTransactions.kvarnx.length} transactions`}
              accent={computedSummary.combinedNet > 0}
            />
            <StatCard
              label="Tax Bracket"
              value={`${computedSummary.bracket}%`}
              sub="Finnish capital gains rate"
            />
            <StatCard
              label="Tax Before Carry-Forward"
              value={fmtEur(computedSummary.taxBeforeCarry)}
              sub="Gross tax estimate"
            />
            <StatCard
              label="Tax After Carry-Forward"
              value={fmtEur(computedSummary.taxAfterCarry)}
              sub={computedSummary.taxSaving > 0 ? `Saving ${fmtEur(computedSummary.taxSaving)}` : 'No carry-forward available'}
              accent
            />
          </div>

          {/* ── Year-over-year chart ───────────────────────────────────────── */}
          {data.yearOverYear?.length > 0 && (
            <div className="tax-chart-section">
              <div className="tax-section-title">Year-over-Year Performance</div>
              <YearChart data={data.yearOverYear} />
            </div>
          )}

          {/* ── Carry-forward tracker ──────────────────────────────────────── */}
          <CarryForwardTracker
            carryForwards={data.carryForwards}
            availableCarryForward={computedSummary.availableCarryForward}
            taxSaving={computedSummary.taxSaving}
            year={year}
          />

          {/* ── Platform tables ────────────────────────────────────────────── */}
          <div className="tax-section-title tax-section-title--mt">Transaction History</div>

          <div className="tax-platform-row">
            <span className="tax-platform-label">Nordnet</span>
            <CsvExportBtn transactions={mergedTransactions.nordnet} platform="nordnet" year={year} />
          </div>
          <PlatformTable
            platform="Nordnet"
            transactions={mergedTransactions.nordnet}
            gains={stats.nordnet.gains}
            losses={stats.nordnet.losses}
            net={stats.nordnet.net}
            isCrypto={false}
            onAddManual={() => setManualModal('nordnet')}
          />

          <div className="tax-platform-row">
            <span className="tax-platform-label">Nordea</span>
            <CsvExportBtn transactions={mergedTransactions.nordea} platform="nordea" year={year} />
          </div>
          <PlatformTable
            platform="Nordea"
            transactions={mergedTransactions.nordea}
            gains={stats.nordea.gains}
            losses={stats.nordea.losses}
            net={stats.nordea.net}
            isCrypto={false}
            onAddManual={() => setManualModal('nordea')}
          />

          <div className="tax-platform-row">
            <span className="tax-platform-label">KvarnX Crypto</span>
            <CsvExportBtn transactions={mergedTransactions.kvarnx} platform="kvarnx" year={year} />
          </div>
          <PlatformTable
            platform="KvarnX"
            transactions={mergedTransactions.kvarnx}
            gains={stats.kvarnx.gains}
            losses={stats.kvarnx.losses}
            net={stats.kvarnx.net}
            isCrypto={true}
            onAddManual={() => setManualModal('kvarnx')}
          />

          {/* ── Vero helper ────────────────────────────────────────────────── */}
          <VeroHelper veroFields={data.veroFields} year={year} />

          {/* ── Disclaimer ─────────────────────────────────────────────────── */}
          <div className="tax-disclaimer">
            <strong>Disclaimer:</strong> This tool provides estimates only and does not constitute tax advice.
            Always verify figures with Vero's official guidance or a qualified tax adviser.
            Gain/loss calculations use EUR equivalents at the time of transaction.
            Finnish capital gains tax rates: 30% on gains up to €30,000; 34% on gains exceeding €30,000 (TVL §45–50).
          </div>
        </div>
      )}

      {/* Manual entry modal */}
      {manualModal && (
        <ManualEntryModal
          platform={manualModal}
          year={year}
          accountId={accountId}
          onClose={() => setManualModal(null)}
          onSaved={handleManualSaved}
        />
      )}
    </div>
  );
}
