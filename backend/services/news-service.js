import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { mockNews } from '../data/mock-news.js';
import { mockNewsFeedExtra } from '../data/mock-news-feed.js';
import { getAllHoldings, getTickerKeywords, getTrackedAssets } from '../config/holdings.js';
import { getWatchlistTickers } from './watchlist-service.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dir, '..', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'news-cache.json');
const LOG_FILE = join(CACHE_DIR, 'news_call_log.json');

const NEWS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const DAILY_LIMIT = 50; // conservative — free tier is 100/day
const API_BASE = 'https://newsapi.org/v2';

// ── Portfolio context ─────────────────────────────────────────────────────────

export const CATEGORIES = ['earnings', 'macro', 'crypto', 'sector', 'regulatory', 'analyst'];

// ── Tagging / classification keyword maps ─────────────────────────────────────

const TICKER_KEYWORDS = {
  SHEL:                ['shell plc', 'royal dutch shell', 'shell energy', 'shell oil'],
  'NORDEA-STABLE':     ['nordea stable return', 'nordea stable', 'nordea balanced fund'],
  'NORDEA-NORDIC-SC':  ['nordea nordic small cap', 'nordea small cap'],
  ADA:                 ['cardano', ' ada coin', 'cardano blockchain'],
  DOT:                 ['polkadot', 'polkadot network', 'polkadot parachain'],
};

const CATEGORY_KEYWORDS = {
  earnings:   ['earnings', 'revenue', 'eps', 'quarterly result', 'beats consensus', 'guidance', 'profit', 'fiscal quarter'],
  crypto:     ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'defi', 'stablecoin', 'solana', 'nft', 'web3'],
  macro:      ['federal reserve', 'fed ', 'ecb ', 'interest rate', 'inflation', 'gdp', 'recession', 'central bank', 'riksbank', 'unemployment', ' cpi ', 'payrolls', 'treasury'],
  regulatory: ['sec ', 'regulation', 'antitrust', 'lawsuit', 'fine ', 'investigation', 'congress', 'legislation', 'compliance'],
  analyst:    ['upgrade', 'downgrade', 'price target', 'analyst', 'outperform', 'buy rating', 'sell rating', 'overweight', 'underweight', 'initiat'],
};

const BULLISH_WORDS = ['surge', 'soar', 'beat', 'record', 'rally', 'upgrade', 'strong', 'growth', 'gain', 'rise', 'jump', 'exceed', 'outperform', 'bullish', 'momentum'];
const BEARISH_WORDS = ['drop', 'fall', 'plunge', 'miss', 'cut', 'downgrade', 'recession', 'loss', 'risk', 'concern', 'decline', 'slump', 'warning', 'bearish', 'disappoint'];

// Minimum requirement: at least one financial keyword must appear in the article
const FINANCIAL_KEYWORDS = ['stock', 'market', 'investor', 'share', 'equity', 'trade', 'fund', 'crypto', 'bitcoin', 'currency', 'rate', 'bank', 'invest', 'portfolio', 'dividend', 'nasdaq', 'nyse', 's&p', 'earnings', 'revenue', 'profit', 'economic', 'gdp', 'inflation', 'bond', 'etf', 'hedge', 'venture', 'ipo', 'acquisition', 'merger', 'valuation'];

// ── In-memory state ───────────────────────────────────────────────────────────

let memCache = null;
let refreshInProgress = false;

// ── File helpers ──────────────────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return fallback; }
}

function writeJson(path, data) {
  ensureDir();
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Daily call log ────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function loadCallLog() {
  ensureDir();
  const log = readJson(LOG_FILE, null);
  if (!log || log.date !== todayStr()) {
    return { date: todayStr(), count: 0, calls: [] };
  }
  return log;
}

function bumpCallLog(endpoint) {
  const log = loadCallLog();
  log.count++;
  log.calls.push({ endpoint, timestamp: new Date().toISOString() });
  writeJson(LOG_FILE, log);
}

function callsRemaining() {
  return Math.max(0, DAILY_LIMIT - loadCallLog().count);
}

// ── Article classification helpers ────────────────────────────────────────────

function tagTickers(text) {
  const lower = ` ${text.toLowerCase()} `;
  const merged = { ...getTickerKeywords(), ...TICKER_KEYWORDS };
  return Object.entries(merged)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([ticker]) => ticker);
}

function classifyCategory(text) {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'sector';
}

function scoreSentiment(text) {
  const lower = text.toLowerCase();
  const bulls = BULLISH_WORDS.filter(w => lower.includes(w)).length;
  const bears = BEARISH_WORDS.filter(w => lower.includes(w)).length;
  if (bulls > bears) return 'bullish';
  if (bears > bulls) return 'bearish';
  return 'neutral';
}

function assignImpact(tickers, portfolioTickers, watchlistTickers) {
  if (tickers.some(t => portfolioTickers.includes(t))) return 'HIGH';
  if (tickers.some(t => watchlistTickers.includes(t))) return 'MEDIUM';
  return 'LOW';
}

function assignTab(tickers, category, portfolioTickers, watchlistTickers) {
  if (tickers.some(t => portfolioTickers.includes(t))) return 'portfolio';
  if (tickers.some(t => watchlistTickers.includes(t))) return 'watchlist';
  if (category === 'analyst') return 'opportunity';
  return 'macro';
}

// ── Article normalization ─────────────────────────────────────────────────────

function normalizeArticle(raw, index, portfolioTickers, watchlistTickers) {
  const text = `${raw.title ?? ''} ${raw.description ?? ''}`;
  const tickers = tagTickers(text);
  const category = classifyCategory(text);
  return {
    id: `news-live-${Date.now()}-${index}`,
    headline: raw.title ?? '',
    source: raw.source?.name ?? 'Unknown',
    publishedAt: raw.publishedAt ?? new Date().toISOString(),
    url: raw.url ?? null,
    category,
    impactRating: assignImpact(tickers, portfolioTickers, watchlistTickers),
    tickers,
    summary: raw.description ?? '',
    sentiment: scoreSentiment(text),
    tab: assignTab(tickers, category, portfolioTickers, watchlistTickers),
    portfolioImpact: null,
    agentCommentary: null,
    relatedAssets: tickers,
    opportunityType: null,
  };
}

// Build mock fallback articles in the same normalized shape
function normaliseCategory(cat) {
  if (cat === 'company' || cat === 'etf') return 'sector';
  return cat;
}

const MOCK_ARTICLES = (() => {
  const portfolioTickers = [...getAllHoldings().map(h => h.ticker), ...getTrackedAssets()];
  const watchlistTickers = getWatchlistTickers();
  return [...mockNews, ...mockNewsFeedExtra]
    .map((a) => {
      const text = `${a.headline ?? ''} ${a.summary ?? ''}`;
      const tickers = a.tickers ?? [];
      const category = normaliseCategory(a.category);
      return {
        ...a,
        category,
        url: null,
        sentiment: scoreSentiment(text),
        tab: assignTab(tickers, category, portfolioTickers, watchlistTickers),
        portfolioImpact: a.portfolioImpact ?? null,
        agentCommentary: null,
        relatedAssets: tickers,
        opportunityType: null,
      };
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
})();

// Builds the NewsAPI search query from currently-held tickers so the feed
// stays relevant when the user adds or switches accounts.
function buildPortfolioQuery() {
  const terms = new Set(['cryptocurrency']);
  for (const h of getAllHoldings()) {
    const kws = TICKER_KEYWORDS[h.ticker];
    if (kws?.length) {
      terms.add(kws[0]);
    } else if (h.name) {
      terms.add(h.name.split(' ')[0].toLowerCase());
    }
  }
  for (const t of [...getWatchlistTickers(), ...getTrackedAssets()]) {
    terms.add(t.toLowerCase());
  }
  return `(${[...terms].join(' OR ')})`;
}

// ── Live API fetch ────────────────────────────────────────────────────────────

async function fetchFromNewsApi(endpoint, params) {
  const key = config.apiKeys.newsApi;
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('apiKey', key);

  const resp = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`NEWS_API_HTTP_${resp.status}`);
  const data = await resp.json();
  if (data.status !== 'ok') throw new Error(`NEWS_API_${data.code ?? 'ERR'}: ${data.message ?? ''}`);
  return data.articles ?? [];
}

// ── Background refresh ────────────────────────────────────────────────────────

async function refreshNewsInBackground() {
  if (refreshInProgress) return;
  refreshInProgress = true;

  try {
    if (callsRemaining() < 2) {
      console.warn('[NewsAPI] Daily limit too low for refresh — skipping');
      return;
    }

    // Call 1: Business top headlines (major curated sources — filtered below by headline keywords)
    const headlines = await fetchFromNewsApi('top-headlines', {
      category: 'business',
      language: 'en',
      pageSize: 20,
    });
    bumpCallLog('top-headlines/business');

    // Call 2: Portfolio-specific news — query built from current holdings
    const portfolioRaw = await fetchFromNewsApi('everything', {
      q: buildPortfolioQuery(),
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: 30,
    });
    bumpCallLog('everything/portfolio');

    // Deduplicate by URL, filter removed/non-financial articles, normalize
    const portfolioTickers = [...getAllHoldings().map(h => h.ticker), ...getTrackedAssets()];
    const watchlistTickers = getWatchlistTickers();
    const seen = new Set();
    const articles = [];
    for (const raw of [...headlines, ...portfolioRaw]) {
      if (!raw.title || raw.title === '[Removed]') continue;
      if (raw.url && seen.has(raw.url)) continue;
      if (raw.url) seen.add(raw.url);
      // Check HEADLINE only — description causes false positives (e.g. "market" in generic context)
      const headline = (raw.title ?? '').toLowerCase();
      if (!FINANCIAL_KEYWORDS.some(kw => headline.includes(kw))) continue;
      articles.push(normalizeArticle(raw, articles.length, portfolioTickers, watchlistTickers));
    }

    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    memCache = { articles, fetchedAt: Date.now() };
    writeJson(CACHE_FILE, memCache);
    console.log(`[NewsAPI] Refresh complete — ${articles.length} articles cached`);
  } catch (err) {
    console.error('[NewsAPI] Refresh failed:', err.message);
  } finally {
    refreshInProgress = false;
  }
}

// ── Response builder ──────────────────────────────────────────────────────────

function buildResponse(articles, ticker, category) {
  let filtered = articles;
  if (ticker && ticker !== 'all') {
    filtered = filtered.filter(a => a.tickers?.includes(ticker));
  }
  if (category && category !== 'all') {
    filtered = filtered.filter(a => a.category === category);
  }

  // Count articles per ticker across the full unfiltered set
  const counts = {};
  for (const a of articles) {
    for (const t of a.tickers ?? []) {
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }

  return {
    articles: filtered,
    counts,
    total: filtered.length,
    categories: CATEGORIES,
    groups: {
      portfolio: [...getAllHoldings().map(h => h.ticker), ...getTrackedAssets()],
      watchlist: getWatchlistTickers(),
      names: Object.fromEntries(getAllHoldings().map(h => [h.ticker, h.name ?? h.ticker])),
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synchronous — always returns immediately.
 * Stale data is served while a background refresh runs.
 * Returns { articles, counts, total, categories, groups }.
 */
export function getNewsFeed({ ticker, category } = {}) {
  const now = Date.now();

  // 1. Fresh memory cache
  if (memCache && now - memCache.fetchedAt < NEWS_TTL_MS) {
    return buildResponse(memCache.articles, ticker, category);
  }

  // 2. Stale memory cache — return immediately, refresh in background
  if (memCache) {
    refreshNewsInBackground();
    return buildResponse(memCache.articles, ticker, category);
  }

  // 3. No memory cache — check file cache
  const fileCache = readJson(CACHE_FILE, null);
  if (fileCache) {
    memCache = fileCache;
    if (now - fileCache.fetchedAt >= NEWS_TTL_MS) refreshNewsInBackground();
    return buildResponse(fileCache.articles, ticker, category);
  }

  // 4. No cache at all — return mock immediately, refresh in background
  refreshNewsInBackground();
  return buildResponse(MOCK_ARTICLES, ticker, category);
}

/**
 * Returns all cached articles without filtering.
 * Used by intelligence-service.js to build the intel feed.
 */
export function getCachedArticles() {
  const fileCache = readJson(CACHE_FILE, null);
  return (memCache ?? fileCache)?.articles ?? MOCK_ARTICLES;
}
