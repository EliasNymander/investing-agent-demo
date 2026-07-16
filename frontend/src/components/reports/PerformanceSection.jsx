import React from 'react';
import './PerformanceSection.css';

function fmt(n, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 0 }).format(n);
}

export default function PerformanceSection({ performance }) {
  if (!performance) return null;
  const { rows, totalWeekPlEur } = performance;

  return (
    <div className="perf-section">
      <div className="perf-summary">
        <span className="text-muted">Portfolio week P&L (EUR equiv.)</span>
        <span className={`text-mono perf-total ${totalWeekPlEur >= 0 ? 'text-green' : 'text-red'}`}>
          {totalWeekPlEur >= 0 ? '+' : ''}{fmt(totalWeekPlEur)}
        </span>
      </div>
      <table className="perf-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Platform</th>
            <th className="text-right">Week Open</th>
            <th className="text-right">Week Close</th>
            <th className="text-right">Week %</th>
            <th className="text-right">Value (EUR)</th>
            <th className="text-right">Total P&L %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker}>
              <td className="text-mono font-bold">{r.ticker}</td>
              <td className="text-muted">{r.platform}</td>
              <td className="text-mono text-right">{r.weekOpen.toLocaleString()}</td>
              <td className="text-mono text-right">{r.weekClose.toLocaleString()}</td>
              <td className={`text-mono text-right ${r.weekPerfPct >= 0 ? 'text-green' : 'text-red'}`}>
                {r.weekPerfPct >= 0 ? '+' : ''}{r.weekPerfPct.toFixed(2)}%
                {r.vsBenchmark != null && (
                  <div className="text-small text-muted">vs BM {r.vsBenchmark >= 0 ? '+' : ''}{r.vsBenchmark.toFixed(2)}%</div>
                )}
              </td>
              <td className="text-mono text-right">{fmt(r.marketValueEur)}</td>
              <td className={`text-mono text-right ${r.totalPlPct >= 0 ? 'text-green' : 'text-red'}`}>
                {r.totalPlPct >= 0 ? '+' : ''}{r.totalPlPct.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
