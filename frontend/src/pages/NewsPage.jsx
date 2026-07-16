import React, { useState, useMemo } from 'react';
import Header from '../components/layout/Header.jsx';
import { useNewsFeed } from '../hooks/useNewsFeed.js';
import './NewsPage.css';


const CATEGORIES = ['all', 'earnings', 'macro', 'crypto', 'sector', 'regulatory', 'analyst'];

// ── Time-ago helper ──────────────────────────────────────────────────────────
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

// ── Category badge color helper ──────────────────────────────────────────────
const CAT_COLORS = {
  earnings:   { color: 'var(--green)',  bg: 'var(--green-dim)' },
  crypto:     { color: '#c084fc',       bg: 'rgba(192,132,252,.12)' },
  macro:      { color: 'var(--blue)',   bg: 'var(--blue-dim)' },
  sector:     { color: 'var(--yellow)', bg: 'var(--yellow-dim)' },
  regulatory: { color: 'var(--red)',    bg: 'var(--red-dim)' },
  analyst:    { color: '#38bdf8',       bg: 'rgba(56,189,248,.12)' },
};

// ── Article card ─────────────────────────────────────────────────────────────
function ArticleCard({ article, activeTicker, onTickerClick, names }) {
  const catStyle = CAT_COLORS[article.category] ?? {};
  return (
    <div className="news-card">
      <div className="news-card-top">
        <span className={`news-impact-badge impact-${article.impactRating}`}>
          {article.impactRating}
        </span>
        <span
          className="news-category-badge"
          style={{ color: catStyle.color, background: catStyle.bg }}
        >
          {article.category}
        </span>
        {article.tickers.length > 0 && (
          <div className="news-ticker-chips">
            {article.tickers.map((t) => (
              <button
                key={t}
                className={`news-ticker-chip ${activeTicker === t ? 'active' : ''}`}
                onClick={() => onTickerClick(t)}
                title={names[t] ?? t}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="news-card-headline">{article.headline}</div>
      <div className="news-card-summary">{article.summary}</div>
      <div className="news-card-meta">
        <span className="news-card-source">{article.source}</span>
        <span className="news-card-time">{timeAgo(article.publishedAt)}</span>
      </div>
    </div>
  );
}

// ── Filter sidebar ────────────────────────────────────────────────────────────
function FilterPanel({ activeTicker, counts, onSelect, portfolioTickers, watchlistTickers, names }) {
  const totalCount = Object.values(counts ?? {}).reduce((s, v) => s + v, 0);

  return (
    <aside className="news-filter-panel">
      <button
        className={`news-filter-btn ${!activeTicker ? 'active' : ''}`}
        onClick={() => onSelect(null)}
      >
        <span className="news-filter-name">All News</span>
        <span className="news-filter-count">{totalCount}</span>
      </button>

      {portfolioTickers.length > 0 && (
        <>
          <div className="news-filter-group-label">Portfolio</div>
          {portfolioTickers.map((ticker) => (
            <button
              key={ticker}
              className={`news-filter-btn ${activeTicker === ticker ? 'active' : ''}`}
              onClick={() => onSelect(ticker)}
            >
              <span className="news-filter-ticker">{ticker.length > 8 ? ticker.slice(0, 7) + '…' : ticker}</span>
              <span className="news-filter-name">{names[ticker] ?? ticker}</span>
              <span className="news-filter-count">{counts?.[ticker] ?? 0}</span>
            </button>
          ))}
        </>
      )}

      {watchlistTickers.length > 0 && (
        <>
          <div className="news-filter-group-label">Watchlist</div>
          {watchlistTickers.map((ticker) => (
            <button
              key={ticker}
              className={`news-filter-btn ${activeTicker === ticker ? 'active' : ''}`}
              onClick={() => onSelect(ticker)}
            >
              <span className="news-filter-ticker">{ticker.length > 8 ? ticker.slice(0, 7) + '…' : ticker}</span>
              <span className="news-filter-name">{names[ticker] ?? ticker}</span>
              <span className="news-filter-count">{counts?.[ticker] ?? 0}</span>
            </button>
          ))}
        </>
      )}
    </aside>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NewsPage() {
  const [activeTicker,   setActiveTicker]   = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  // Always fetch counts from the unfiltered endpoint so sidebar numbers don't change
  const { feed: allFeed } = useNewsFeed(null, null);
  const { feed, isLoading, error } = useNewsFeed(
    activeTicker,
    activeCategory === 'all' ? null : activeCategory
  );

  const counts           = allFeed?.counts ?? {};
  const articles         = feed?.articles ?? [];
  const portfolioTickers = allFeed?.groups?.portfolio ?? [];
  const watchlistTickers = allFeed?.groups?.watchlist ?? [];
  const names            = allFeed?.groups?.names ?? {};

  const subtitle = useMemo(() => {
    const parts = [];
    if (activeTicker) parts.push(names[activeTicker] ?? activeTicker);
    if (activeCategory !== 'all') parts.push(activeCategory);
    const label = parts.length ? parts.join(' · ') : 'all holdings & watchlist';
    return `${feed?.total ?? '…'} articles · ${label}`;
  }, [activeTicker, activeCategory, feed?.total, names]);

  function handleTickerClick(ticker) {
    setActiveTicker((prev) => (prev === ticker ? null : ticker));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="News Feed" subtitle={subtitle} />

      <div className="news-page">
        <FilterPanel
          activeTicker={activeTicker}
          counts={counts}
          onSelect={setActiveTicker}
          portfolioTickers={portfolioTickers}
          watchlistTickers={watchlistTickers}
          names={names}
        />

        <div className="news-main">
          {/* Category filter bar */}
          <div className="news-category-bar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                data-cat={cat}
                className={`news-cat-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'all' ? 'All categories' : cat}
              </button>
            ))}
          </div>

          {/* Article list */}
          <div className="news-feed-list">
            {isLoading && (
              <div className="news-empty">Loading news…</div>
            )}
            {error && (
              <div className="error-msg" style={{ margin: 24 }}>Failed to load news.</div>
            )}
            {!isLoading && !error && articles.length === 0 && (
              <div className="news-empty">
                <div style={{ fontSize: 32, color: 'var(--text-dim)' }}>◎</div>
                <div>No articles match this filter.</div>
              </div>
            )}
            {!isLoading && articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                activeTicker={activeTicker}
                onTickerClick={handleTickerClick}
                names={names}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
