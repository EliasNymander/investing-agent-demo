import React, { useState, useEffect } from 'react';
import { saveConfig } from '../../api/config.js';
import { fetchHoldings, saveHoldingsApi } from '../../api/holdings.js';
import { useConfig } from '../../context/ConfigContext.jsx';
import WizardProgress from './WizardProgress.jsx';
import Step1Holdings, { ensureLots } from './Step1Holdings.jsx';
import Step2ApiKeys from './Step2ApiKeys.jsx';
import Step3Schedule from './Step3Schedule.jsx';
import './SetupWizard.css';

const defaultState = {
  holdings: { nordnet: [], nordea: [], kvarnx: [], displayCurrency: 'EUR' },
  apiKeys: { alphaVantage: '', coinGecko: '', newsApi: '', anthropic: '' },
  schedule: { dailyAlertTime: '08:00', weeklyReportDay: 'Monday', timezone: 'Europe/Helsinki' },
};

const PURCHASE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Mirrors backend/config/holdings.js isValidPurchaseDate() — keep in sync.
function isValidPurchaseDate(value) {
  if (!PURCHASE_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Local calendar date, not UTC — mirrors backend/config/holdings.js todayIsoDate()
// and Step1Holdings.jsx todayIsoLocal() (Helsinki runs ahead of UTC).
function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Mirrors backend/config/holdings.js deriveHoldingTotals() — no rounding.
function deriveHoldingTotals(lots) {
  const totalUnits = lots.reduce((s, l) => s + (Number(l.units) || 0), 0);
  const totalCost  = lots.reduce((s, l) => s + (Number(l.totalCost) || 0), 0);
  const avgCost    = totalUnits > 0 ? totalCost / totalUnits : 0;
  return { units: totalUnits, avgCost };
}

// Mirrors backend/config/holdings.js saveHoldings() validation exactly, so the
// client never passes what the server would reject, or rejects what the
// server would allow.
function validateStep1(holdingsData) {
  const warnings = [];
  const errors = [];
  const allTickers = {};

  for (const platform of ['nordnet', 'nordea', 'kvarnx']) {
    const seenInPlatform = new Set();
    for (const h of holdingsData[platform] || []) {
      if (!h.ticker) { errors.push(`A ${platform} entry is missing a ticker.`); continue; }

      if (seenInPlatform.has(h.ticker)) {
        errors.push(`Duplicate ticker "${h.ticker}" in ${platform} — each holding must be unique per platform.`);
      }
      seenInPlatform.add(h.ticker);
      (allTickers[h.ticker] = allTickers[h.ticker] ?? []).push(platform);

      const lots = Array.isArray(h.lots) ? h.lots : [];
      if (lots.length === 0) {
        errors.push(`${h.ticker}: at least one purchase lot is required.`);
        continue;
      }

      const errorCountBefore = errors.length;
      const currencies = new Set();
      lots.forEach((lot, li) => {
        const lotLabel = `${h.ticker} lot ${li + 1}`;
        const units = Number(lot.units), totalCost = Number(lot.totalCost);
        if (!(units > 0))      errors.push(`${lotLabel}: units must be greater than 0.`);
        if (!(totalCost >= 0)) errors.push(`${lotLabel}: total cost cannot be negative.`);
        if (!lot.currency)     errors.push(`${lotLabel}: currency is required.`);
        else currencies.add(lot.currency);
        if (!isValidPurchaseDate(lot.purchaseDate))
          errors.push(`${lotLabel}: purchase date must be a valid date (YYYY-MM-DD).`);
        else if (lot.purchaseDate > todayIsoLocal())
          errors.push(`${lotLabel}: purchase date cannot be in the future.`);

        // Blank/zero totalCost with real units (e.g. a CSV row with no
        // acquisition value, or a half-filled manual lot) is incomplete, not
        // invalid — flag it per-lot so a nonzero blended average elsewhere in
        // the same holding can't hide an understated basis from this one lot.
        if (units > 0 && totalCost === 0) {
          warnings.push(`${lotLabel}: has units but no cost — basis will be understated.`);
        }
      });
      if (currencies.size > 1) {
        errors.push(`${h.ticker}: all lots must use the same currency (found ${[...currencies].join(', ')}).`);
      }

      // Holding-level fallback: catches the case where every lot's cost is
      // missing (blended avgCost === 0), same as the backend's warning.
      if (errors.length === errorCountBefore) {
        const { units, avgCost } = deriveHoldingTotals(lots);
        if (units > 0 && avgCost === 0) {
          warnings.push(`Cost basis missing for ${h.ticker} — P&L calculations may be inaccurate`);
        }
      }
    }
  }

  for (const [ticker, platforms] of Object.entries(allTickers)) {
    if (platforms.length > 1) {
      warnings.push(`"${ticker}" appears in multiple platforms (${platforms.join(', ')}) — is this intentional?`);
    }
  }

  return { errors, warnings };
}

export default function SetupWizard({ onClose, accountName }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState(defaultState);
  const [saving, setSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState([]);
  const [step1Warnings, setStep1Warnings] = useState([]);
  const [step1WarningSeen, setStep1WarningSeen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadFailedDismissed, setLoadFailedDismissed] = useState(false);
  const { completeSetup } = useConfig();

  useEffect(() => {
    fetchHoldings()
      .then((holdings) => {
        if (!holdings) return;
        // Normalize every holding into real lots[] on load so legacy
        // (pre-lots) rows are backed by actual state, not just the display
        // fallback — otherwise an untouched row fails save-time validation
        // even though it visually shows a purchase.
        const normalized = { ...holdings };
        for (const platform of ['nordnet', 'nordea', 'kvarnx']) {
          normalized[platform] = (holdings[platform] || []).map((h) => ({ ...h, lots: ensureLots(h) }));
        }
        setData((d) => ({ ...d, holdings: normalized }));
      })
      .catch(() => setLoadFailed(true));
  }, []);

  // Reset warning state whenever holdings data is edited so re-validation runs on next click
  useEffect(() => {
    if (step1WarningSeen) {
      setStep1Warnings([]);
      setStep1WarningSeen(false);
      setSaveErrors([]);
    }
  }, [data.holdings]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const handleNext = () => {
    if (step !== 1) { setStep((s) => s + 1); return; }
    if (step1WarningSeen) {
      setStep1Warnings([]);
      setStep1WarningSeen(false);
      setStep(2);
      return;
    }
    const { errors, warnings } = validateStep1(data.holdings);
    if (errors.length > 0) { setSaveErrors(errors); return; }
    if (warnings.length > 0) { setSaveErrors([]); setStep1Warnings(warnings); setStep1WarningSeen(true); return; }
    setStep(2);
  };

  const handleBack = () => {
    setStep1Warnings([]);
    setStep1WarningSeen(false);
    setSaveErrors([]);
    setStep((s) => s - 1);
  };

  const handleDemoMode = async () => {
    try { await fetch('/api/demo/enable', { method: 'POST' }); } catch { /* non-critical */ }
    onClose?.();
  };

  const finish = async () => {
    setSaving(true);
    setSaveErrors([]);
    try {
      const holdingsResult = await saveHoldingsApi(data.holdings);
      if (!holdingsResult.success) {
        setSaveErrors(holdingsResult.errors?.length ? holdingsResult.errors : ['Failed to save holdings.']);
        return;
      }
      const saved = await saveConfig({ apiKeys: data.apiKeys, schedule: data.schedule });
      completeSetup(saved);
      onClose?.();
    } catch (e) {
      setSaveErrors([e.message]);
    } finally {
      setSaving(false);
    }
  };

  const buttonsBlocked = loadFailed && !loadFailedDismissed;

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        <div className="wizard-header">
          <h1 className="wizard-title">{accountName ? `Setting up: ${accountName}` : 'Welcome to Investing Agent'}</h1>
          <p className="wizard-subtitle">{accountName ? 'Configure holdings and settings for this account.' : "Let's set up your portfolio. You can edit everything later in Settings."}</p>
        </div>
        <WizardProgress step={step} total={3} />

        {loadFailed && !loadFailedDismissed && (
          <div style={{
            padding: '10px 24px',
            background: 'var(--red-dim, rgba(248,113,113,0.12))',
            borderBottom: '1px solid var(--red, #f87171)',
            fontSize: 12,
            color: 'var(--red, #f87171)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            <span style={{ flex: 1 }}>
              ⚠ Could not load your saved holdings — the backend may be offline.
              Do not save until this is resolved, or your existing data may be overwritten.
            </span>
            <button
              onClick={() => setLoadFailedDismissed(true)}
              style={{ background: 'none', border: 'none', color: 'var(--red, #f87171)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
            >×</button>
          </div>
        )}

        <div className="wizard-body">
          {step === 1 && (
            <Step1Holdings holdings={data.holdings} onChange={(v) => update('holdings', v)} />
          )}
          {step === 2 && (
            <Step2ApiKeys apiKeys={data.apiKeys} onChange={(v) => update('apiKeys', v)} />
          )}
          {step === 3 && (
            <Step3Schedule schedule={data.schedule} onChange={(v) => update('schedule', v)} />
          )}
        </div>
        {step === 1 && step1Warnings.length > 0 && (
          <div style={{ padding: '0 24px 8px', color: 'var(--yellow, #fbbf24)', fontSize: 12 }}>
            {step1Warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}
        {saveErrors.length > 0 && (
          <div style={{ padding: '0 24px 8px', color: 'var(--red, #f87171)', fontSize: 12 }}>
            {saveErrors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
        <div className="wizard-footer">
          {step === 1 && (
            <div className="wizard-demo-side">
              <button className="wizard-btn wizard-btn--demo" onClick={handleDemoMode}>
                🎭 Try Demo Mode Instead
              </button>
              <div className="wizard-demo-note">
                Your entered data won't be saved if you switch to demo mode now
              </div>
            </div>
          )}
          {step > 1 && (
            <button className="wizard-btn wizard-btn--back" onClick={handleBack} disabled={buttonsBlocked}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button className="wizard-btn wizard-btn--next" onClick={handleNext} disabled={buttonsBlocked}>
              {step === 1 && step1WarningSeen ? 'Continue anyway →' : 'Next →'}
            </button>
          ) : (
            <button className="wizard-btn wizard-btn--finish" onClick={finish} disabled={saving || buttonsBlocked}>
              {saving ? 'Saving…' : 'Launch Dashboard →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
