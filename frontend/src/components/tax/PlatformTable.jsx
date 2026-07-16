import React, { useState } from 'react';
import './PlatformTable.css';

function fmtEur(n) {
  if (n == null) return '—';
  return (n >= 0 ? '+' : '') + '€' + Math.abs(n).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fi-FI');
}

function GainBadge({ value }) {
  if (value == null) return null;
  const cls = value > 0 ? 'pt-gain--pos' : value < 0 ? 'pt-gain--neg' : 'pt-gain--zero';
  return <span className={`pt-gain-badge ${cls}`}>{fmtEur(value)}</span>;
}

export default function PlatformTable({ platform, transactions, gains, losses, net, isCrypto, onAddManual }) {
  const [expanded, setExpanded] = useState(true);

  const typeLabel = { stock: 'Stock', etf: 'ETF', fund: 'Fund', crypto: 'Crypto' };

  return (
    <div className="pt-section">
      <div className="pt-section-header" onClick={() => setExpanded((v) => !v)}>
        <div className="pt-section-title">
          <span className="pt-section-toggle">{expanded ? '▾' : '▸'}</span>
          <span className="pt-section-name">{platform}</span>
          {isCrypto && (
            <span className="pt-crypto-warning" title="Self-reporting required for Vero">⚠ Self-report</span>
          )}
        </div>
        <div className="pt-section-stats">
          <span className="pt-stat-label">Gains</span>
          <span className="pt-stat-val pt-stat-val--pos">+€{gains.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="pt-stat-sep">·</span>
          <span className="pt-stat-label">Losses</span>
          <span className="pt-stat-val pt-stat-val--neg">€{losses.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="pt-stat-sep">·</span>
          <span className="pt-stat-label">Net</span>
          <GainBadge value={net} />
        </div>
      </div>

      {expanded && (
        <>
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th className="pt-num">Qty</th>
                  <th className="pt-num">Buy Cost</th>
                  <th className="pt-num">Sell Price</th>
                  <th>Sell Date</th>
                  <th className="pt-num">Gain / Loss</th>
                  {isCrypto && <th>Note</th>}
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={isCrypto ? 8 : 7} className="pt-empty">
                      No transactions recorded for this platform yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className={tx.source === 'manual' ? 'pt-row--manual' : ''}>
                      <td>
                        <div className="pt-asset-name">{tx.assetName}</div>
                        <div className="pt-asset-ticker">{tx.ticker}</div>
                      </td>
                      <td><span className="pt-type-badge">{typeLabel[tx.type] ?? tx.type}</span></td>
                      <td className="pt-num">{tx.qty}</td>
                      <td className="pt-num">{tx.buyCostEur != null ? `€${tx.buyCostEur.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                      <td className="pt-num">{tx.sellPriceEur != null ? `€${tx.sellPriceEur.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                      <td className="pt-date">{fmtDate(tx.sellDate)}</td>
                      <td className="pt-num"><GainBadge value={tx.gainEur} /></td>
                      {isCrypto && <td className="pt-note">{tx.note ?? '—'}</td>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {onAddManual && (
            <div className="pt-add-row">
              <button className="pt-add-btn" onClick={onAddManual}>+ Add manual entry</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
