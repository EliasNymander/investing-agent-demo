import React, { useState, useMemo, useCallback } from 'react';
import Header from '../components/layout/Header.jsx';
import SentimentBar from '../components/intelligence/SentimentBar.jsx';
import WeeklyDigest from '../components/intelligence/WeeklyDigest.jsx';
import ArticleCard from '../components/intelligence/ArticleCard.jsx';
import { useIntelligence } from '../hooks/useIntelligence.js';
import { useActiveAccount, useTrackedAssets } from '../hooks/useAccounts.js';
import { saveTrackedAssetsApi } from '../api/accounts.js';
import './IntelligencePage.css';

const TABS = [
  { key: 'portfolio',   label: 'Your Portfolio News',  icon: '◈' },
  { key: 'macro',       label: 'Market & Macro',        icon: '◐' },
  { key: 'opportunity', label: 'Opportunities',         icon: '◎' },
  { key: 'watchlist',   label: 'Watchlist',             icon: '◉' },
];

function loadBookmarks() {
  try {
    return new Set(JSON.parse(localStorage.getItem('intel-bookmarks') ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveBookmarks(set) {
  localStorage.setItem('intel-bookmarks', JSON.stringify([...set]));
}

export default function IntelligencePage() {
  const { articles, sentimentStats, weeklyDigest, cryptoPrices,
          watchlistTickers, holdingNames, isLoading, error } = useIntelligence();
  const { trackedAssets, mutate: mutateTracked } = useTrackedAssets();
  const { activeAccount } = useActiveAccount();

  const [activeTab,   setActiveTab]   = useState('portfolio');
  const [activeAsset, setActiveAsset] = useState(null);
  const [bookmarks,   setBookmarks]   = useState(loadBookmarks);
  const [trackInput,  setTrackInput]  = useState('');
  const [trackOpen,   setTrackOpen]   = useState(false);

  const [filters, setFilters] = useState({
    asset:          'all',
    impact:         'all',
    sentiment:      'all',
    period:         'all',
    search:         '',
    savedOnly:      false,
    portfolioMoved: false,
  });

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  // Dynamic asset list: unique tickers from all articles + tracked assets
  const allAssets = useMemo(() => {
    const tickers = new Set(trackedAssets);
    for (const a of articles) {
      for (const t of a.relatedAssets ?? []) tickers.add(t);
    }
    return [...tickers].sort();
  }, [articles, trackedAssets]);

  const handleAssetClick = useCallback((ticker) => {
    setActiveAsset((prev) => (prev === ticker ? null : ticker));
  }, []);

  const toggleBookmark = useCallback((id) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveBookmarks(next);
      return next;
    });
  }, []);

  async function handleAddTracked() {
    const t = trackInput.trim().toUpperCase();
    if (!t || !activeAccount || trackedAssets.includes(t)) {
      setTrackOpen(false); setTrackInput(''); return;
    }
    await saveTrackedAssetsApi(activeAccount.id, [...trackedAssets, t]);
    mutateTracked();
    setTrackInput(''); setTrackOpen(false);
  }

  async function handleRemoveTracked(ticker) {
    if (!activeAccount) return;
    await saveTrackedAssetsApi(activeAccount.id, trackedAssets.filter(t => t !== ticker));
    mutateTracked();
  }

  // ── Filtering (all client-side) ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const now = Date.now();
    return articles.filter((a) => {
      if (a.tab !== activeTab) return false;
      if (activeAsset && !a.relatedAssets.includes(activeAsset)) return false;
      if (filters.asset !== 'all' && !a.relatedAssets.includes(filters.asset)) return false;
      if (filters.impact !== 'all' && a.impactRating !== filters.impact) return false;
      if (filters.sentiment !== 'all' && a.sentiment !== filters.sentiment) return false;
      if (filters.period !== 'all') {
        const age = now - new Date(a.publishedAt).getTime();
        if (filters.period === 'today' && age > 86_400_000)    return false;
        if (filters.period === 'week'  && age > 604_800_000)   return false;
        if (filters.period === 'month' && age > 2_592_000_000) return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !a.headline.toLowerCase().includes(q) &&
          !a.summary.toLowerCase().includes(q) &&
          !a.agentCommentary?.toLowerCase().includes(q)
        ) return false;
      }
      if (filters.savedOnly && !bookmarks.has(a.id)) return false;
      if (filters.portfolioMoved) {
        const age = now - new Date(a.publishedAt).getTime();
        if (age > 86_400_000 || a.impactRating !== 'HIGH' || a.sentiment === 'neutral') return false;
      }
      return true;
    });
  }, [articles, activeTab, activeAsset, filters, bookmarks]);

  // ── Header subtitle ──────────────────────────────────────────────────────
  const subtitle = useMemo(() => {
    const total = articles.filter((a) => a.tab === activeTab).length;
    return `${filtered.length} of ${total} articles · ${
      activeAsset ? `filtered: ${activeAsset}` : 'all assets'
    }`;
  }, [articles, filtered, activeTab, activeAsset]);

  const hasActiveFilter =
    filters.asset !== 'all' ||
    filters.impact !== 'all' ||
    filters.sentiment !== 'all' ||
    filters.period !== 'all' ||
    filters.search !== '' ||
    filters.savedOnly ||
    filters.portfolioMoved ||
    activeAsset !== null;

  function clearFilters() {
    setFilters({ asset: 'all', impact: 'all', sentiment: 'all', period: 'all', search: '', savedOnly: false, portfolioMoved: false });
    setActiveAsset(null);
  }

  return (
    <div className="intel-page">
      <Header title="Intelligence Feed" subtitle={subtitle} />

      <SentimentBar stats={sentimentStats} />
      <WeeklyDigest digest={weeklyDigest} />

      {/* Tab bar */}
      <div className="intel-tab-bar">
        {TABS.map(({ key, label, icon }) => {
          const count = articles.filter((a) => a.tab === key).length;
          return (
            <button
              key={key}
              className={`intel-tab ${activeTab === key ? 'intel-tab--active' : ''}`}
              onClick={() => { setActiveTab(key); setActiveAsset(null); }}
            >
              <span className="intel-tab-icon">{icon}</span>
              {label}
              <span className="intel-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Tracked asset chips */}
      {trackedAssets.length > 0 && (
        <div className="intel-tracked-bar">
          <span className="intel-tracked-label">Tracking:</span>
          {trackedAssets.map((t) => (
            <span key={t} className="intel-tracked-chip">
              {t}
              <button
                className="intel-tracked-remove"
                onClick={() => handleRemoveTracked(t)}
                title={`Stop tracking ${t}`}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* Smart filter bar */}
      <div className="intel-filter-bar">
        {/* Search */}
        <div className="intel-search-wrap">
          <span className="intel-search-icon">⊘</span>
          <input
            className="intel-search"
            type="text"
            placeholder="Search headlines, summaries…"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
          {filters.search && (
            <button className="intel-search-clear" onClick={() => setFilter('search', '')}>×</button>
          )}
        </div>

        {/* Asset dropdown — dynamic from articles + tracked assets */}
        <select
          className="intel-filter-select"
          value={filters.asset}
          onChange={(e) => setFilter('asset', e.target.value)}
        >
          <option value="all">All Assets</option>
          {allAssets.map((t) => (
            <option key={t} value={t}>{holdingNames[t] ?? t}</option>
          ))}
        </select>

        {/* Impact */}
        <select
          className="intel-filter-select"
          value={filters.impact}
          onChange={(e) => setFilter('impact', e.target.value)}
        >
          <option value="all">All Impact</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>

        {/* Sentiment */}
        <select
          className="intel-filter-select"
          value={filters.sentiment}
          onChange={(e) => setFilter('sentiment', e.target.value)}
        >
          <option value="all">All Sentiment</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
          <option value="neutral">Neutral</option>
        </select>

        {/* Period */}
        <select
          className="intel-filter-select"
          value={filters.period}
          onChange={(e) => setFilter('period', e.target.value)}
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>

        {/* Toggles */}
        <label className={`intel-toggle ${filters.savedOnly ? 'intel-toggle--on' : ''}`}>
          <input
            type="checkbox"
            checked={filters.savedOnly}
            onChange={(e) => setFilter('savedOnly', e.target.checked)}
          />
          ⊛ Saved
        </label>

        <label className={`intel-toggle ${filters.portfolioMoved ? 'intel-toggle--on' : ''}`}>
          <input
            type="checkbox"
            checked={filters.portfolioMoved}
            onChange={(e) => setFilter('portfolioMoved', e.target.checked)}
          />
          ⚡ Moved today
        </label>

        {hasActiveFilter && (
          <button className="intel-clear-btn" onClick={clearFilters}>
            Clear filters
          </button>
        )}

        {/* Track asset button / inline form */}
        {trackOpen ? (
          <div className="intel-track-form">
            <input
              className="intel-track-input"
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTracked();
                if (e.key === 'Escape') { setTrackOpen(false); setTrackInput(''); }
              }}
              placeholder="e.g. ASML"
              autoFocus
            />
            <button className="intel-track-btn intel-track-btn--add" onClick={handleAddTracked}>Add</button>
            <button className="intel-track-btn" onClick={() => { setTrackOpen(false); setTrackInput(''); }}>Cancel</button>
          </div>
        ) : (
          <button className="intel-track-btn" onClick={() => setTrackOpen(true)}>+ Track asset</button>
        )}
      </div>

      {/* Active asset chip indicator */}
      {activeAsset && (
        <div className="intel-active-asset-banner">
          Filtering by asset:
          <span className="intel-active-asset-chip">{activeAsset}</span>
          <button className="intel-active-asset-clear" onClick={() => setActiveAsset(null)}>× Clear</button>
        </div>
      )}

      {/* Article list */}
      <div className="intel-feed">
        {isLoading && <div className="loading">Loading intelligence feed…</div>}

        {error && (
          <div className="error-msg" style={{ margin: '24px 32px' }}>Failed to load intelligence feed.</div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="intel-empty">
            <div className="intel-empty-icon">◎</div>
            <div className="intel-empty-title">
              {activeTab === 'watchlist' && watchlistTickers.length === 0
                ? 'No watchlist assets'
                : 'No articles match this filter'}
            </div>
            <div className="intel-empty-sub">
              {activeTab === 'watchlist' && watchlistTickers.length === 0
                ? 'Add assets to your Watchlist page, or use "+ Track asset" above.'
                : hasActiveFilter
                  ? 'Try adjusting or clearing your filters.'
                  : 'No articles available for this tab yet.'}
            </div>
            {hasActiveFilter && activeTab !== 'watchlist' && (
              <button className="intel-empty-clear" onClick={clearFilters}>Clear all filters</button>
            )}
          </div>
        )}

        {!isLoading && filtered.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            isBookmarked={bookmarks.has(article.id)}
            onBookmark={toggleBookmark}
            activeAsset={activeAsset}
            onAssetClick={handleAssetClick}
            cryptoPrices={cryptoPrices}
          />
        ))}
      </div>
    </div>
  );
}
