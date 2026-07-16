import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

function formatLabel(entry, period) {
  const key = entry.date || entry.time;
  if (!key) return '';
  if (period === '1D') return key;
  const d = new Date(key);
  if (period === '1W' || period === '1M') return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('en-IE', { month: 'short', year: '2-digit' });
}

function tickInterval(period, dataLen) {
  if (period === '1D') return 1;
  if (period === '1W') return 1;
  if (period === '1M') return 4;
  if (period === '3M') return 2;
  return Math.floor(dataLen / 8);
}

const CustomTooltip = ({ active, payload, label, period, valueKey, prefix }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ color: 'var(--text)', fontWeight: 700 }}>
        {prefix}{typeof val === 'number' ? val.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val}
      </div>
    </div>
  );
};

export default function PlatformChart({ data, period, height = 260 }) {
  const valueKey = data?.[0]?.value != null ? 'value' : 'price';
  const prefix = valueKey === 'value' ? '€' : '';

  const isPositive = useMemo(() => {
    if (!data || data.length < 2) return true;
    return data[data.length - 1][valueKey] >= data[0][valueKey];
  }, [data, valueKey]);

  const color = isPositive ? 'var(--green)' : 'var(--red)';
  const gradientId = isPositive ? 'gradGreen' : 'gradRed';
  const gradientColor = isPositive ? '#00c896' : '#ff4d4d';

  const xKey = data?.[0]?.time != null ? 'time' : 'date';
  const interval = tickInterval(period, data?.length ?? 10);

  if (!data || data.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>No data</div>;
  }

  const minVal = Math.min(...data.map((d) => d[valueKey]));
  const maxVal = Math.max(...data.map((d) => d[valueKey]));
  const padding = (maxVal - minVal) * 0.15;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={gradientColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={gradientColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tickFormatter={(v) => formatLabel({ [xKey]: v }, period)}
          interval={interval}
          tick={{ fill: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[minVal - padding, maxVal + padding]}
          tickFormatter={(v) => `${prefix}${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`}
          tick={{ fill: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip period={period} valueKey={valueKey} prefix={prefix} />} />
        <Area
          type="monotone"
          dataKey={valueKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
