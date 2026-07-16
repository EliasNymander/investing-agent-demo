import React from 'react';
import ImpactBadge from '../alerts/ImpactBadge.jsx';
import './ArticleCard.css';

const OPPORTUNITY_LABELS = {
  'emerging-trend':  'EMERGING TREND',
  'worth-watching':  'WORTH WATCHING',
  'analyst-upgrade': 'ANALYST UPGRADE',
  'new-opportunity': 'NEW OPPORTUNITY',
};

const TICKER_NAMES = {
  IWDA: 'iShares World', 'NOVO-B': 'Novo Nordisk', ASML: 'ASML',
  VWCE: 'Vanguard All-World', 'VOLV-B': 'Volvo B', SHEL: 'Shell',
  'NORDEA-STABLE': 'Nordea Stable', 'NORDEA-NORDIC-SC': 'Nordea Nordic SC',
  BTC: 'Bitcoin', ADA: 'Cardano', DOT: 'Polkadot',
  SPOT: 'Spotify', EQNR: 'Equinor', KNEBV: 'KONE',
};

const CRYPTO_TICKERS = new Set(['BTC', 'ADA', 'DOT']);

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  2) return 'just now';
  if (hours <  1) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(isoStr).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' });
}

function fmtEurCompact(eur) {
  if (eur >= 1000) {
    return `€${(eur / 1000).toFixed(1)}k`;
  }
  return `€${eur.toFixed(0)}`;
}

export default function ArticleCard({
  article,
  isBookmarked,
  onBookmark,
  activeAsset,
  onAssetClick,
  cryptoPrices,
}) {
  const hasCryptoAssets = article.relatedAssets.some((t) => CRYPTO_TICKERS.has(t));

  return (
    <article className={`intel-card intel-card--${article.sentiment}`}>
      {/* Top row: badges + bookmark */}
      <div className="intel-card-top">
        <span className={`intel-sentiment-badge sentiment--${article.sentiment}`}>
          {article.sentiment}
        </span>
        <ImpactBadge rating={article.impactRating} />

        {article.opportunityType && (
          <span className="intel-opp-badge">
            {OPPORTUNITY_LABELS[article.opportunityType] ?? article.opportunityType}
          </span>
        )}

        {article.relatedAssets.length > 0 && (
          <div className="intel-asset-chips">
            {article.relatedAssets.map((ticker) => {
              const livePrice = CRYPTO_TICKERS.has(ticker) ? cryptoPrices?.[ticker] : null;
              return (
                <button
                  key={ticker}
                  className={`intel-asset-chip ${activeAsset === ticker ? 'intel-asset-chip--active' : ''}`}
                  onClick={() => onAssetClick(ticker)}
                  title={TICKER_NAMES[ticker] ?? ticker}
                >
                  {ticker}
                  {livePrice != null && (
                    <span className="intel-chip-price">{fmtEurCompact(livePrice)}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <button
          className={`intel-bookmark ${isBookmarked ? 'intel-bookmark--saved' : ''}`}
          onClick={() => onBookmark(article.id)}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark article'}
        >
          {isBookmarked ? '⊛' : '⊕'}
        </button>
      </div>

      {/* Headline */}
      <h3 className="intel-headline">{article.headline}</h3>

      {/* Agent commentary */}
      <p className="intel-commentary">↗ {article.agentCommentary}</p>

      {/* Summary */}
      <p className="intel-summary">{article.summary}</p>

      {/* Meta row */}
      <div className="intel-meta">
        <span className="intel-source">{article.source}</span>
        <span className="intel-dot">·</span>
        <span className="intel-time">{timeAgo(article.publishedAt)}</span>
        <a href="#" className="intel-read-more" onClick={(e) => e.preventDefault()}>
          Read more →
        </a>
        {hasCryptoAssets && (
          <span className="intel-cg-attr">
            <img src="/coingecko-logo.svg" alt="" className="intel-cg-logo" />
            <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer">
              CoinGecko
            </a>
          </span>
        )}
      </div>
    </article>
  );
}
