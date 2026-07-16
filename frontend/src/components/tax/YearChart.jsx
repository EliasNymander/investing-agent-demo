import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';

const GREEN  = '#00c896';
const RED    = '#ff4d4d';
const YELLOW = '#f0b429';

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function formatEur(v) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}€${(abs / 1000).toFixed(1)}k`;
  return `${sign}€${abs.toFixed(0)}`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: getCssVar('--surface'),
      border: `1px solid ${getCssVar('--border')}`,
      borderRadius: 6,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: getCssVar('--text'), marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.fill, marginBottom: 2 }}>
          {p.name}: {p.value >= 0 ? '+' : ''}€{Math.abs(p.value).toLocaleString('fi-FI', { minimumFractionDigits: 2 })}
        </div>
      ))}
      {payload[0]?.payload.taxOwed > 0 && (
        <div style={{
          color: YELLOW,
          marginTop: 4,
          borderTop: `1px solid ${getCssVar('--border')}`,
          paddingTop: 4,
        }}>
          Tax owed: €{payload[0].payload.taxOwed.toLocaleString('fi-FI', { minimumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
};

export default function YearChart({ data }) {
  if (!data?.length) return null;

  const gridColor   = getCssVar('--border');
  const tickColor   = getCssVar('--text-dim');
  const legendColor = getCssVar('--text-muted');

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: tickColor, fontSize: 11 }}
            axisLine={{ stroke: gridColor }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatEur}
            tick={{ fill: tickColor, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: legendColor, paddingTop: 8 }}
          />
          <ReferenceLine y={0} stroke={gridColor} />

          <Bar dataKey="nordnetGain" name="Nordnet" stackId="a" fill={GREEN} radius={[0, 0, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.year} fill={entry.nordnetGain >= 0 ? GREEN : RED} fillOpacity={0.7} />
            ))}
          </Bar>
          <Bar dataKey="nordeaGain" name="Nordea" stackId="a" fill="#4da6ff">
            {data.map((entry) => (
              <Cell key={entry.year} fill={entry.nordeaGain >= 0 ? '#4da6ff' : '#ff8fa3'} fillOpacity={0.7} />
            ))}
          </Bar>
          <Bar dataKey="kvarnxGain" name="KvarnX" stackId="a" fill={YELLOW} radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.year} fill={entry.kvarnxGain >= 0 ? YELLOW : RED} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
