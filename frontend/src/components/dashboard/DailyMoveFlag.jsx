import React from 'react';

export default function DailyMoveFlag({ flag }) {
  if (!flag) return null;
  const pct = flag.pct;
  const sign = pct >= 0 ? '+' : '';

  if (!flag.active) {
    return (
      <span className="badge badge-muted text-mono">
        {sign}{pct.toFixed(2)}%
      </span>
    );
  }

  const cls = pct > 0 ? 'badge-green' : 'badge-red';
  const arrow = pct > 0 ? '▲' : '▼';

  return (
    <span className={`badge ${cls} text-mono`}>
      {arrow} {sign}{pct.toFixed(2)}%
    </span>
  );
}
