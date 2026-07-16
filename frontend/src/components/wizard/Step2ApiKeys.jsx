import React from 'react';

const KEYS = [
  {
    field: 'anthropic',
    label: 'Anthropic API Key',
    note: 'Required for Phase 2 AI analysis. Get it at console.anthropic.com',
    placeholder: 'sk-ant-...',
  },
  {
    field: 'alphaVantage',
    label: 'Alpha Vantage API Key',
    note: 'Required for Phase 2 stock/ETF prices. Free tier at alphavantage.co',
    placeholder: 'Your Alpha Vantage key',
  },
  {
    field: 'coinGecko',
    label: 'CoinGecko API Key',
    note: 'Optional — free tier works without a key. coingecko.com/en/api',
    placeholder: 'CG-... (optional)',
  },
  {
    field: 'newsApi',
    label: 'NewsAPI Key',
    note: 'Required for Phase 2 news headlines. Free tier at newsapi.org',
    placeholder: 'Your NewsAPI key',
  },
];

export default function Step2ApiKeys({ apiKeys, onChange }) {
  const update = (field, value) => onChange({ ...apiKeys, [field]: value });

  return (
    <div>
      <div className="wizard-step-title">API Keys</div>
      <div className="wizard-step-desc">
        These are only needed for Phase 2 (live data). For Phase 1 mock data, you can skip all fields —
        just click Next. Keys are stored locally in user_config.json and never sent anywhere.
      </div>
      <div className="wizard-key-group">
        {KEYS.map(({ field, label, note, placeholder }) => (
          <div key={field} className="wizard-key-row">
            <label className="wizard-key-label">{label}</label>
            <input
              type="password"
              className="wizard-input"
              placeholder={placeholder}
              value={apiKeys[field] || ''}
              onChange={(e) => update(field, e.target.value)}
              autoComplete="off"
            />
            <span className="wizard-key-note">{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
