import React from 'react';

const CONFIG = {
  HIGH:   { cls: 'badge-red',    label: 'HIGH IMPACT' },
  MEDIUM: { cls: 'badge-yellow', label: 'MEDIUM IMPACT' },
  LOW:    { cls: 'badge-muted',  label: 'LOW IMPACT' },
};

export default function ImpactBadge({ rating }) {
  const c = CONFIG[rating] ?? CONFIG.LOW;
  return <span className={`badge ${c.cls}`}>{c.label}</span>;
}
