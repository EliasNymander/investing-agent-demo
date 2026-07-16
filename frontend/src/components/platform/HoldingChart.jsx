import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useTickerHistory } from '../../hooks/useHistory.js';
import DailyMoveFlag from '../dashboard/DailyMoveFlag.jsx';
import './HoldingChart.css';

function formatLabel(entry, period) {
  const key = entry.date || entry.time;
  if (!key) return '';
  if (period === '1D') return key;
  const d = new Date(key);
  if (period === '1W' || period === '1M') return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('en-IE', { month: 'short', year: '2-digit' });
}

const MiniTooltip = ({ active, payload, label, period, currency }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const currencySymbols = { USD: '$', EUR: '€', SEK: 'kr' };
  const sym = currencySymbols[currency] ?? '';
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 5,
      padding: '6px 10px',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--text)', fontWeight: 700 }}>
        {sym}{typeof val === 'number' ? val.toLocaleString('en-IE', { minimumFractionDigits: 2 }) : val}
      </div>
    </div>
  );
};

export default function HoldingChart({ holding, period }) {
  const { history, isLoading } = useTickerHistory(holding.ticker, period);

  const isPositive = useMemo(() => {
    if (!history || history.length < 2) return holding.plPct >= 0;
    return history[history.length - 1].price >= history[0].price;
  }, [history, holding.plPct]);

  const periodPct = useMemo(() => {
    if (!history || history.length < 2) return null;
    const start = history[0].price;
    const end = history[history.length - 1].price;
    return ((end - start) / start) * 100;
  }, [history]);

  const color = isPositive ? 'var(--green)' : 'var(--red)';
  const gradientId = `grad_${holding.ticker.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const gradientColor = isPositive ? '#00c896' : '#ff4d4d';

  const xKey = history?.[0]?.time != null ? 'time' : 'date';
  const minVal = history ? Math.min(...history.map((d) => d.price)) : 0;
  const maxVal = history ? Math.max(...history.map((d) => d.price)) : 0;
  const padding = (maxVal - minVal) * 0.15;

  const currencySymbols = { USD: '$', EUR: '€', SEK: 'kr' };
  const sym = currencySymbols[holding.currency] ?? '';

  return (
    <div className="holding-chart-card">
      <div className="holding-chart-header">
        <div className="holding-chart-left">
          <span className="holding-chart-ticker">{holding.ticker}</span>
          <span className="holding-chart-name">{holding.name}</span>
        </div>
        <div className="holding-chart-right">
          {holding.flag && <DailyMoveFlag flag={holding.flag} />}
        </div>
      </div>

      <div className="holding-chart-prices">
        <span className="holding-chart-current text-mono">
          {sym}{holding.currentPrice?.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
        </span>
        {periodPct != null && (
          <span className={`holding-chart-period-pct text-mono ${periodPct >= 0 ? 'text-green' : 'text-red'}`}>
            {periodPct >= 0 ? '+' : ''}{periodPct.toFixed(2)}%
          </span>
        )}
      </div>

      <div className="holding-chart-meta text-muted">
        {holding.qty} units · avg cost {sym}{holding.avgCost?.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
        &nbsp;·&nbsp;
        <span className={holding.plPct >= 0 ? 'text-green' : 'text-red'}>
          {holding.plPct >= 0 ? '+' : ''}{holding.plPct?.toFixed(2)}% all-time
        </span>
      </div>

      <div className="holding-chart-area">
        {isLoading ? (
          <div className="holding-chart-loading">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={history} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={gradientColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <YAxis domain={[minVal - padding, maxVal + padding]} hide />
              <XAxis dataKey={xKey} hide />
              <Tooltip content={<MiniTooltip period={period} currency={holding.currency} />} />
              <ReferenceLine
                y={holding.avgCost}
                stroke="var(--text-dim)"
                strokeDasharray="4 3"
                strokeWidth={1}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 3, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
