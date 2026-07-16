import React from 'react';
import './TradeCard.css';

function fmtEur(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function fmtPrice(price, currency) {
  if (price == null) return '—';
  const sym = currency === 'EUR' ? '€' : currency === 'SEK' ? 'kr' : '$';
  const formatted = price >= 1000
    ? price.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : price.toFixed(2);
  return `${sym}${formatted}`;
}

function fmtPct(n) {
  if (n == null) return null;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const days  = Math.floor(diff / 86400000);
  const months = Math.floor(days / 30);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) > 1 ? 's' : ''} ago`;
}

function Stars({ count }) {
  return (
    <span className="tc-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= count ? 'star-on' : 'star-off'}>★</span>
      ))}
    </span>
  );
}

export default function TradeCard({ entry, onEdit, onDelete }) {
  const isBuy  = entry.action === 'BUY';
  const isSell = entry.action === 'SELL';
  const pnl    = isBuy ? entry.unrealizedPnlPct : entry.realizedPnlPct;
  const pnlEur = isBuy ? entry.unrealizedPnlEur  : entry.realizedPnlEur;
  const pnlPos = pnl != null && pnl >= 0;
  const isOpen = entry.status === 'open';

  return (
    <div className={`tc-card ${isBuy ? 'tc-buy' : 'tc-sell'}`}>
      <div className="tc-header">
        <div className="tc-header-left">
          <span className={`tc-action-badge ${isBuy ? 'badge-buy' : 'badge-sell'}`}>
            {entry.action}
          </span>
          <span className="tc-ticker">{entry.ticker}</span>
          <span className="tc-dot">·</span>
          <span className="tc-name">{entry.name}</span>
          <span className="tc-dot">·</span>
          <span className="tc-platform">{entry.platform}</span>
        </div>
        <div className="tc-header-right">
          <span className="tc-time">{timeAgo(entry.date)}</span>
        </div>
      </div>

      <div className="tc-price-row">
        <span className="tc-qty-price">
          {entry.qty.toLocaleString('en', { maximumFractionDigits: 4 })} ×{' '}
          {fmtPrice(entry.price, entry.currency)}{' '}
          <span className="tc-total-native">
            ({fmtPrice(entry.totalValue, entry.currency)})
          </span>
          <span className="tc-total-eur"> · {fmtEur(entry.totalValueEur)}</span>
        </span>
        <span className={`tc-status-badge ${isOpen ? 'status-open' : isSell ? 'status-sell' : 'status-closed'}`}>
          {isOpen ? 'OPEN' : isSell ? 'CLOSED' : 'SOLD'}
        </span>
      </div>

      {/* P&L row for open BUY */}
      {isBuy && isOpen && entry.currentPrice != null && (
        <div className="tc-pnl-row">
          <span className="tc-current-price">
            Current {fmtPrice(entry.currentPrice, entry.currency)} · Value {fmtEur(entry.currentValueEur)}
          </span>
          <span className={`tc-pnl ${pnlPos ? 'pnl-pos' : 'pnl-neg'}`}>
            Unrealized: {pnlEur != null ? (pnlPos ? '+' : '') + fmtEur(pnlEur) : '—'}
            {pnl != null && <span className="tc-pnl-pct"> ({fmtPct(pnl)})</span>}
          </span>
        </div>
      )}

      {/* P&L row for SELL */}
      {isSell && entry.realizedPnlEur != null && (
        <div className="tc-pnl-row">
          {entry.linkedBuyDate && (
            <span className="tc-current-price">
              Closed position opened {timeAgo(entry.linkedBuyDate)}
            </span>
          )}
          <span className={`tc-pnl ${pnlPos ? 'pnl-pos' : 'pnl-neg'}`}>
            Realized: {pnlEur != null ? (pnlPos ? '+' : '') + fmtEur(pnlEur) : '—'}
            {pnl != null && <span className="tc-pnl-pct"> ({fmtPct(pnl)})</span>}
          </span>
        </div>
      )}

      {/* BUY entry that was sold (status: closed) */}
      {isBuy && entry.status === 'closed' && entry.sellDate && (
        <div className="tc-pnl-row">
          <span className="tc-current-price">Position closed {timeAgo(entry.sellDate)}</span>
        </div>
      )}

      <div className="tc-divider" />

      <div className="tc-reasoning">"{entry.reasoning}"</div>

      <div className="tc-footer">
        <Stars count={entry.confidence} />
        {entry.signalRef && (
          <span className="tc-signal-ref">
            · Signal: {entry.signalRef.ticker} {entry.signalRef.type}{' '}
            <span className="tc-signal-id">({entry.signalRef.id})</span>
          </span>
        )}
        {entry.tags?.length > 0 && (
          <div className="tc-tags">
            {entry.tags.map((t) => <span key={t} className="tc-tag">{t}</span>)}
          </div>
        )}
        <div className="tc-actions">
          <button className="tc-btn" onClick={() => onEdit(entry)}>Edit</button>
          <button className="tc-btn tc-btn-del" onClick={() => onDelete(entry.id)}>Delete</button>
        </div>
      </div>
    </div>
  );
}
