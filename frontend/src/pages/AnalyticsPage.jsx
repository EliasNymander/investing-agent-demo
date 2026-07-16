import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import Header from '../components/layout/Header.jsx';
import { useAnalytics } from '../hooks/useAnalytics.js';
import './AnalyticsPage.css';

// ── Color palettes ──────────────────────────────────────────────────────────
const ALLOC_COLORS = {
  Stock:  '#4da6ff',
  ETF:    '#00c896',
  Fund:   '#f0b429',
  Crypto: '#c084fc',
};
const GEO_COLORS = {
  US:     '#4da6ff',
  Crypto: '#c084fc',
  Europe: '#00c896',
  Global: '#f0b429',
  Nordic: '#38bdf8',
};
const SECTOR_COLORS = {
  Technology:    '#4da6ff',
  Crypto:        '#c084fc',
  Diversified:   '#00c896',
  'Fixed Income':'#f0b429',
  'Real Estate': '#ff4d4d',
};

// ── Filter constants ──────────────────────────────────────────────────────────
const CLASS_ORDER  = ['stock','etf','fund','crypto','bond','reit','commodity','warrant','certificate','other'];
const CLASS_LABELS = {
  stock:'Stocks', etf:'ETFs', fund:'Funds', crypto:'Crypto', bond:'Bonds',
  reit:'REITs', commodity:'Commodities', warrant:'Warrants', certificate:'Certificates', other:'Other',
};
const DEFAULT_ON = new Set(['stock','etf','crypto']);

function loadFilter() {
  try {
    const raw = JSON.parse(localStorage.getItem('analytics-filter-v1') ?? 'null');
    if (!raw) return null;
    return { enabledClasses: new Set(raw.enabledClasses), disabledTickers: new Set(raw.disabledTickers) };
  } catch { return null; }
}
function saveFilter(enabledClasses, disabledTickers) {
  localStorage.setItem('analytics-filter-v1', JSON.stringify({
    enabledClasses: [...enabledClasses], disabledTickers: [...disabledTickers],
  }));
}

// Re-aggregate all analytics sections from a filtered holdings list
function recompute(analytics, filteredHoldings) {
  if (!analytics || !filteredHoldings.length) return null;
  const totalEur = filteredHoldings.reduce((s, h) => s + h.marketValueEur, 0);

  const allocationMap = {}, geoMap = {}, sectorMap = {};
  for (const h of filteredHoldings) {
    const label = h.assetClass === 'etf' ? 'ETF' : h.assetClass === 'fund' ? 'Fund'
      : h.assetClass === 'crypto' ? 'Crypto' : h.assetClass === 'bond' ? 'Bond' : 'Stock';
    allocationMap[label] = (allocationMap[label] ?? 0) + h.marketValueEur;
    geoMap[h.region]     = (geoMap[h.region]     ?? 0) + h.marketValueEur;
    sectorMap[h.sector]  = (sectorMap[h.sector]  ?? 0) + h.marketValueEur;
  }
  const toGroups = map => Object.entries(map)
    .map(([name, value]) => ({ name, value: +value.toFixed(2), pct: +((value / totalEur) * 100).toFixed(1) }))
    .sort((a, b) => b.value - a.value);

  const totalCostBasisEur     = filteredHoldings.reduce((s, h) => s + (h.costBasisEur ?? 0), 0);
  const totalPlAbsEur         = filteredHoldings.reduce((s, h) => s + (h.plAbsEur ?? 0), 0);
  const totalPlPct            = totalCostBasisEur > 0 ? (totalPlAbsEur / totalCostBasisEur) * 100 : null;
  const holdingsWithCostBasis = filteredHoldings.filter(h => (h.costBasisEur ?? 0) > 0).length;

  return {
    totalEur: +totalEur.toFixed(2),
    allocation: toGroups(allocationMap),
    geography:  toGroups(geoMap),
    sectors:    toGroups(sectorMap),
    performance: {
      totalCostBasisEur: +totalCostBasisEur.toFixed(2),
      totalPlAbsEur:      +totalPlAbsEur.toFixed(2),
      totalPlPct:         totalPlPct != null ? +totalPlPct.toFixed(2) : null,
      holdingsWithCostBasis,
      holdingsTotal: filteredHoldings.length,
    },
    holdings: filteredHoldings,
  };
}

// ── Tooltip for donut charts ─────────────────────────────────────────────────
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{d.name}</div>
      <div style={{ color: 'var(--text-muted)' }}>
        €{d.value.toLocaleString('en-IE', { maximumFractionDigits: 0 })} · {d.pct}%
      </div>
    </div>
  );
}

// ── Donut card ───────────────────────────────────────────────────────────────
function DonutCard({ title, data, colorMap, insight }) {
  return (
    <div className="card analytics-donut-card">
      <div className="section-title">{title}</div>
      <div className="donut-chart-wrap">
        <PieChart width={160} height={160}>
          <Pie
            data={data}
            cx={80} cy={80}
            innerRadius={48} outerRadius={72}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={colorMap[entry.name] ?? '#8b8fa8'} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </div>
      <div className="donut-legend">
        {data.map((entry) => (
          <div key={entry.name} className="donut-legend-row">
            <span className="donut-legend-dot" style={{ background: colorMap[entry.name] ?? '#8b8fa8' }} />
            <span className="donut-legend-name">{entry.name}</span>
            <span className="donut-legend-pct">{entry.pct}%</span>
          </div>
        ))}
      </div>
      {insight && <div className="donut-insight">{insight}</div>}
    </div>
  );
}

// ── Performance since purchase ────────────────────────────────────────────────
function PerformanceCard({ performance, holdings }) {
  const { totalPlAbsEur, totalPlPct, holdingsWithCostBasis, holdingsTotal } = performance;
  const hasTotal = totalPlPct != null;
  const totalPositive = totalPlAbsEur >= 0;

  return (
    <div className="card analytics-performance-card">
      <div className="section-title">Performance Since Purchase</div>

      <div className="performance-summary-row">
        <span className="performance-summary-abs" style={{ color: !hasTotal ? 'var(--text-dim)' : totalPositive ? 'var(--green)' : 'var(--red)' }}>
          {hasTotal
            ? `${totalPositive ? '+' : ''}€${totalPlAbsEur.toLocaleString('en-IE', { maximumFractionDigits: 0 })}`
            : '—'}
        </span>
        {hasTotal && (
          <span className="performance-summary-pct" style={{ color: totalPositive ? 'var(--green)' : 'var(--red)' }}>
            ({totalPositive ? '+' : ''}{totalPlPct.toFixed(1)}%)
          </span>
        )}
        <span className="performance-summary-note text-muted">
          {holdingsWithCostBasis} of {holdingsTotal} holdings have cost-basis data
        </span>
      </div>

      <div className="performance-list">
        {holdings.map((h) => (
          <div key={h.ticker} className="performance-row">
            <div className="performance-row-info">
              <span className="performance-row-ticker">{h.ticker}</span>
              <span className="performance-row-date text-muted">
                {h.purchaseDate ?? 'date unknown'}
              </span>
            </div>
            {h.plPct != null ? (
              <>
                <span className="performance-row-abs" style={{ color: h.plAbsEur >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {h.plAbsEur >= 0 ? '+' : ''}€{h.plAbsEur.toLocaleString('en-IE', { maximumFractionDigits: 0 })}
                </span>
                <span className="performance-row-pct" style={{ color: h.plPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {h.plPct >= 0 ? '+' : ''}{h.plPct.toFixed(1)}%
                </span>
              </>
            ) : (
              <span className="performance-row-na text-muted">no cost basis</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Benchmark comparison — placeholder until purchase dates are entered ──────
function BenchmarkSection() {
  return (
    <div className="card analytics-benchmark-card">
      <div className="section-title">vs Benchmarks</div>
      <p className="text-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
        Coming soon — add purchase dates to your holdings in Settings to unlock a real
        comparison against MSCI World.
      </p>
    </div>
  );
}

// ── Insight generators ───────────────────────────────────────────────────────
function allocationInsight(allocation) {
  const crypto = allocation.find((a) => a.name === 'Crypto');
  if (!crypto) return null;
  if (crypto.pct > 35) return `Crypto is ${crypto.pct}% of your portfolio — very high volatility exposure.`;
  if (crypto.pct > 20) return `Crypto at ${crypto.pct}% is a significant volatility driver.`;
  return null;
}
function geoInsight(geography) {
  const us = geography.find((g) => g.name === 'US');
  if (us?.pct > 40) return `${us.pct}% US concentration — adding Nordic/European assets improves diversification.`;
  return null;
}
function sectorInsight(sectors) {
  const tech = sectors.find((s) => s.name === 'Technology');
  if (tech?.pct > 35) return `Technology at ${tech.pct}% — high single-sector concentration.`;
  return null;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { analytics, isLoading, error } = useAnalytics();

  const [enabledClasses,  setEnabledClasses]  = useState(() => loadFilter()?.enabledClasses  ?? DEFAULT_ON);
  const [disabledTickers, setDisabledTickers] = useState(() => loadFilter()?.disabledTickers ?? new Set());
  const [showIndividual,  setShowIndividual]  = useState(false);

  const allHoldings    = analytics?.holdings ?? [];
  const presentClasses = useMemo(
    () => CLASS_ORDER.filter(c => allHoldings.some(h => h.assetClass === c)),
    [allHoldings],
  );
  const filteredHoldings = useMemo(
    () => allHoldings.filter(h => enabledClasses.has(h.assetClass) && !disabledTickers.has(h.ticker)),
    [allHoldings, enabledClasses, disabledTickers],
  );
  const view = useMemo(() => recompute(analytics, filteredHoldings), [analytics, filteredHoldings]);

  function toggleClass(cls) {
    const next = new Set(enabledClasses);
    next.has(cls) ? next.delete(cls) : next.add(cls);
    setEnabledClasses(next); saveFilter(next, disabledTickers);
  }
  function toggleTicker(ticker) {
    const next = new Set(disabledTickers);
    next.has(ticker) ? next.delete(ticker) : next.add(ticker);
    setDisabledTickers(next); saveFilter(enabledClasses, next);
  }

  if (isLoading) return <div className="loading">Computing analytics…</div>;
  if (error)     return <div className="error-msg">Failed to load analytics.</div>;
  if (!analytics) return null;

  const enabledNames   = CLASS_ORDER.filter(c => enabledClasses.has(c) && presentClasses.includes(c));
  const filterSummary  = `Showing ${filteredHoldings.length} of ${allHoldings.length} assets · ${
    enabledNames.map(c => CLASS_LABELS[c]).join(', ')}${
    disabledTickers.size ? ` · ${disabledTickers.size} individually excluded` : ''}`;

  return (
    <div>
      <Header
        title="Portfolio Analytics"
        subtitle={view
          ? `€${view.totalEur.toLocaleString('en-IE', { maximumFractionDigits: 0 })} total${
              view.performance.totalPlPct != null
                ? ` · ${view.performance.totalPlAbsEur >= 0 ? '+' : ''}${view.performance.totalPlPct.toFixed(1)}% since purchase`
                : ''
            }`
          : '…'}
      />

      {/* Level 1: asset class toggles */}
      <div className="analytics-filter-bar">
        {presentClasses.map(cls => (
          <button
            key={cls}
            className={`analytics-class-pill${enabledClasses.has(cls) ? ' analytics-class-pill--on' : ''}`}
            onClick={() => toggleClass(cls)}
          >
            {CLASS_LABELS[cls] ?? cls}
          </button>
        ))}
      </div>

      {/* Level 2: individual asset checkboxes */}
      <div className="analytics-individual-wrap">
        <button className="analytics-individual-toggle" onClick={() => setShowIndividual(v => !v)}>
          {showIndividual ? '▾ Hide individual assets' : '▸ Show individual assets'}
        </button>
        {showIndividual && (
          <div className="analytics-individual-panel">
            {presentClasses.map(cls => {
              const clsHoldings = allHoldings.filter(h => h.assetClass === cls);
              const clsOn       = enabledClasses.has(cls);
              return (
                <div key={cls} className="analytics-individual-group">
                  <div className="analytics-individual-group-label">{CLASS_LABELS[cls]}</div>
                  {clsHoldings.map(h => (
                    <label key={h.ticker} className={`analytics-individual-row${clsOn ? '' : ' analytics-individual-row--dimmed'}`}>
                      <input
                        type="checkbox"
                        checked={clsOn && !disabledTickers.has(h.ticker)}
                        disabled={!clsOn}
                        onChange={() => { if (clsOn) toggleTicker(h.ticker); }}
                      />
                      <span className="analytics-ticker-label">{h.ticker}</span>
                      {h.name && <span className="analytics-name-label">— {h.name}</span>}
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter summary line */}
      <div className="analytics-filter-summary">{filterSummary}</div>

      <div className="analytics-page">
        <BenchmarkSection />

        {!view ? (
          <div className="analytics-empty">
            <div className="analytics-empty-icon">◎</div>
            <div>No assets match your current filters — adjust the filter above</div>
          </div>
        ) : (
          <>
            {/* Donut charts */}
            <div className="analytics-grid-3">
              <DonutCard title="Asset Allocation"     data={view.allocation} colorMap={ALLOC_COLORS}  insight={allocationInsight(view.allocation)} />
              <DonutCard title="Geographic Exposure"  data={view.geography}  colorMap={GEO_COLORS}    insight={geoInsight(view.geography)} />
              <DonutCard title="Sector Concentration" data={view.sectors}    colorMap={SECTOR_COLORS} insight={sectorInsight(view.sectors)} />
            </div>

            {/* Performance */}
            <PerformanceCard performance={view.performance} holdings={view.holdings} />
          </>
        )}
      </div>
    </div>
  );
}
