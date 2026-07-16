import React from 'react';

const CONFIG = {
  BUY:   { cls: 'badge-green',  emoji: '🟢', label: 'BUY SIGNAL' },
  SELL:  { cls: 'badge-red',    emoji: '🔴', label: 'SELL SIGNAL' },
  WATCH: { cls: 'badge-yellow', emoji: '🟡', label: 'WATCH' },
};

export default function SignalBadge({ type }) {
  const c = CONFIG[type] ?? CONFIG.WATCH;
  return (
    <span className={`badge ${c.cls}`}>
      {c.emoji} {c.label}
    </span>
  );
}
