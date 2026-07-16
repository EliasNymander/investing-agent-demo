import React from 'react';
import DailyMoveFlag from './DailyMoveFlag.jsx';

function fmt(n, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtPct(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export default function HoldingRow({ holding }) {
  const plColor = holding.plPct >= 0 ? 'text-green' : 'text-red';

  return (
    <tr className={holding.flag?.active ? 'holding-row flagged' : 'holding-row'}>
      <td>
        <div className="holding-ticker">{holding.ticker}</div>
        <div className="holding-name">{holding.name}</div>
        {holding.dataSource && (
          <div className="holding-source text-muted">{holding.dataSource}</div>
        )}
      </td>
      <td className="text-mono text-right">{holding.units}</td>
      <td className="text-mono text-right">{fmt(holding.avgCost, holding.currency)}</td>
      <td className="text-mono text-right">
        {fmt(holding.currentPrice, holding.currency)}
        {holding.isNav && <span className="nav-label"> NAV</span>}
      </td>
      <td className="text-mono text-right">{fmt(holding.marketValueEur)}</td>
      <td className={`text-mono text-right ${plColor}`}>
        {fmt(holding.plAbsEur)}<br />
        <span className="text-small">{fmtPct(holding.plPct)}</span>
      </td>
      <td className="text-right">
        <DailyMoveFlag flag={holding.flag} />
      </td>
    </tr>
  );
}
