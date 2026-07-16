import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { mockPrices, fxRates } from '../data/mock-prices.js';
import { getLiveStockSymbols, getAllStockTickers } from '../config/holdings.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dir, '..', 'cache');
const PRICE_CACHE_FILE = join(CACHE_DIR, 'alphavantage-prices-cache.json');
const INDICATORS_CACHE_FILE = join(CACHE_DIR, 'alphavantage-indicators-cache.json');
const LOG_FILE = join(CACHE_DIR, 'av_call_log.json');

const PRICE_TTL_MS = 15 * 60 * 1000;
const INDICATORS_TTL_MS = 60 * 60 * 1000;
const DAILY_LIMIT = 25;
const RATE_LIMIT_DELAY_MS = 12000; // 5 calls/minute = 12s minimum between calls
const API_BASE = 'https://www.alphavantage.co/query';

/** Returns the current held ticker list fresh from holdings — call at use time, not module load. */
export function getHeldTickers() { return getAllStockTickers(); }

// In-memory caches
let priceMemCache = null;
let indicatorsMemCache = {}; // keyed by ticker

// Background refresh lock — prevents duplicate concurrent fetches
let priceRefreshInProgress = false;

// Global rate limit tracker shared across price and indicator calls
let lastApiCallAt = 0;

// ── File helpers ─────────────────────────────────────────────────────────────

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
  return log.count;
}

function callsRemaining() {
  return Math.max(0, DAILY_LIMIT - loadCallLog().count);
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rateLimitedFetch(url) {
  const now = Date.now();
  const elapsed = now - lastApiCallAt;
  if (lastApiCallAt > 0 && elapsed < RATE_LIMIT_DELAY_MS) {
    await delay(RATE_LIMIT_DELAY_MS - elapsed);
  }
  lastApiCallAt = Date.now();

  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`AV_API_ERROR_${resp.status}`);
  const data = await resp.json();
  // Alpha Vantage returns 200 with an Information key when rate-limited or quota exceeded
  if (data.Information) throw new Error('AV_QUOTA_EXCEEDED');
  if (data.Note) throw new Error('AV_RATE_LIMIT');
  return data;
}

// ── Mock data helpers ─────────────────────────────────────────────────────────

function buildMockEntry(ticker) {
  const m = mockPrices[ticker];
  if (!m) return null;
  const eur =
    m.currency === 'USD' ? +(m.price * fxRates.USD_EUR).toFixed(2)
    : m.currency === 'SEK' ? +(m.price * fxRates.SEK_EUR).toFixed(2)
    : m.price;
  return {
    price: m.price,
    currency: m.currency,
    eur,
    changePct: m.dailyPct,
    changeAbs: null,
    prevClose: m.prevClose,
    latestTradingDay: m.updatedAt?.split('T')[0] ?? null,
    dataSource: 'mock',
  };
}

function buildAllMockPrices() {
  const prices = {};
  for (const ticker of getAllStockTickers()) {
    prices[ticker] = buildMockEntry(ticker);
  }
  return prices;
}

// ── Live API fetch ────────────────────────────────────────────────────────────

async function fetchGlobalQuote(avSymbol) {
  const key = config.apiKeys.alphaVantage;
  const url = `${API_BASE}?function=GLOBAL_QUOTE&symbol=${avSymbol}&apikey=${key}`;
  const data = await rateLimitedFetch(url);
  const q = data['Global Quote'];
  if (!q || !q['05. price']) throw new Error(`EMPTY_QUOTE_${avSymbol}`);

  const price = parseFloat(q['05. price']);
  const prevClose = parseFloat(q['08. previous close']);
  const changeAbs = parseFloat(q['09. change']);
  const changePct = parseFloat(q['10. change percent'].replace('%', ''));
  const eur = +(price * fxRates.USD_EUR).toFixed(2);

  return {
    price,
    currency: 'USD',
    eur,
    changePct,
    changeAbs,
    prevClose,
    latestTradingDay: q['07. latest trading day'],
    dataSource: 'live',
  };
}

// ── Background price refresh ──────────────────────────────────────────────────
// Fetches all 3 live tickers sequentially with rate-limit delay between calls.
// Fire-and-forget — never blocks a user query.

async function refreshPricesInBackground() {
  if (priceRefreshInProgress) return;
  priceRefreshInProgress = true;

  try {
    const liveTickers      = getLiveStockSymbols();
    const liveTickerKeys   = Object.keys(liveTickers);
    const unresolvedTickers = getAllStockTickers().filter((t) => !liveTickers[t]);

    if (callsRemaining() < liveTickerKeys.length) {
      console.warn('[AlphaVantage] Daily limit too low for price refresh — skipping');
      return;
    }

    const prices = {};

    for (const [ticker, avSymbol] of Object.entries(liveTickers)) {
      try {
        prices[ticker] = await fetchGlobalQuote(avSymbol);
        bumpCallLog(`GLOBAL_QUOTE/${avSymbol}`);
      } catch (err) {
        console.error(`[AlphaVantage] Failed to fetch ${avSymbol}:`, err.message);
        const fallback = priceMemCache?.prices?.[ticker] ?? buildMockEntry(ticker);
        prices[ticker] = fallback ? { ...fallback, dataSource: 'stale_cache' } : null;
      }
    }

    // Always attach unresolved tickers with mock data
    for (const ticker of unresolvedTickers) {
      prices[ticker] = buildMockEntry(ticker);
    }

    priceMemCache = { prices, fetchedAt: Date.now() };
    writeJson(PRICE_CACHE_FILE, priceMemCache);
    console.log('[AlphaVantage] Background price refresh complete');
  } catch (err) {
    console.error('[AlphaVantage] Background refresh failed:', err.message);
  } finally {
    priceRefreshInProgress = false;
  }
}

// ── Public: getStockPrices ────────────────────────────────────────────────────

/**
 * Always returns immediately — stale data is served while a background refresh runs.
 * Returns { prices, dataSource, cacheAgeMin, warning, dailyLimitReached }.
 * prices shape: { ASML: { price, currency, eur, changePct, changeAbs, prevClose,
 *                          latestTradingDay, dataSource }, ... }
 * dataSource: 'live' | 'stale_cache' | 'file_cache' | 'mock'
 */
export async function getStockPrices() {
  const now = Date.now();

  // 1. Fresh memory cache — return immediately, no refresh needed
  if (priceMemCache && now - priceMemCache.fetchedAt < PRICE_TTL_MS) {
    return {
      prices: priceMemCache.prices,
      dataSource: 'live',
      cacheAgeMin: Math.floor((now - priceMemCache.fetchedAt) / 60000),
      warning: null,
      dailyLimitReached: false,
    };
  }

  // 2. Stale memory cache — return immediately, trigger background refresh
  if (priceMemCache) {
    refreshPricesInBackground();
    const age = Math.floor((now - priceMemCache.fetchedAt) / 60000);
    return {
      prices: priceMemCache.prices,
      dataSource: 'stale_cache',
      cacheAgeMin: age,
      warning: '⚠️ Prices refreshing in background — showing last cached data',
      dailyLimitReached: callsRemaining() < Object.keys(getLiveStockSymbols()).length,
    };
  }

  // 3. No memory cache — check file cache
  const fileCache = readJson(PRICE_CACHE_FILE, null);
  if (fileCache) {
    priceMemCache = fileCache;
    const age = Math.floor((now - fileCache.fetchedAt) / 60000);
    const fresh = now - fileCache.fetchedAt < PRICE_TTL_MS;
    if (!fresh) refreshPricesInBackground();
    return {
      prices: fileCache.prices,
      dataSource: fresh ? 'file_cache' : 'stale_cache',
      cacheAgeMin: age,
      warning: fresh ? null : '⚠️ Prices refreshing in background — showing last cached data',
      dailyLimitReached: callsRemaining() < Object.keys(getLiveStockSymbols()).length,
    };
  }

  // 4. No cache at all — return mock immediately, refresh in background
  refreshPricesInBackground();
  return {
    prices: buildAllMockPrices(),
    dataSource: 'mock',
    cacheAgeMin: null,
    warning: '⚠️ Fetching live prices for the first time — showing static fallback data',
    dailyLimitReached: false,
  };
}

// ── Public: getTechnicalData ──────────────────────────────────────────────────

/**
 * Fetches RSI(14), MACD, SMA(50), SMA(200) for a single confirmed live ticker.
 * Costs 4 API calls — only call on explicit user request.
 * First fetch takes ~36–48s due to rate limiting; cached for 60 minutes thereafter.
 * Returns { ticker, rsi, macd, sma50, sma200, dataSource, cacheAgeMin } or { error }.
 */
export async function getTechnicalData(ticker) {
  const upperTicker = ticker.toUpperCase();
  const avSymbol = getLiveStockSymbols()[upperTicker];

  if (!avSymbol) {
    return {
      ticker: upperTicker,
      error: `Technical data not available for ${upperTicker} — symbol unresolved or not a confirmed live ticker`,
      dataSource: 'error',
    };
  }

  // Check memory cache
  const memEntry = indicatorsMemCache[upperTicker];
  if (memEntry && Date.now() - memEntry.fetchedAt < INDICATORS_TTL_MS) {
    return { ...memEntry.data, dataSource: 'cached', cacheAgeMin: Math.floor((Date.now() - memEntry.fetchedAt) / 60000) };
  }

  // Check file cache
  const fileCache = readJson(INDICATORS_CACHE_FILE, {});
  const fileEntry = fileCache[upperTicker];
  if (fileEntry && Date.now() - fileEntry.fetchedAt < INDICATORS_TTL_MS) {
    indicatorsMemCache[upperTicker] = fileEntry;
    return { ...fileEntry.data, dataSource: 'cached', cacheAgeMin: Math.floor((Date.now() - fileEntry.fetchedAt) / 60000) };
  }

  // Need 4 API calls — check daily budget
  if (callsRemaining() < 4) {
    const stale = memEntry ?? fileEntry;
    if (stale) {
      return {
        ...stale.data,
        dataSource: 'stale_cache',
        warning: '⚠️ Daily API limit reached — showing last cached indicators',
      };
    }
    return {
      ticker: upperTicker,
      error: 'Daily API limit reached and no cached indicator data available',
      dataSource: 'error',
    };
  }

  const key = config.apiKeys.alphaVantage;

  try {
    // RSI — 14-day
    const rsiRaw = await rateLimitedFetch(
      `${API_BASE}?function=RSI&symbol=${avSymbol}&interval=daily&time_period=14&series_type=close&apikey=${key}`
    );
    bumpCallLog(`RSI/${avSymbol}`);
    const rsiMap = rsiRaw['Technical Analysis: RSI'];
    const rsiDate = rsiMap ? Object.keys(rsiMap)[0] : null;
    const rsi = rsiDate ? parseFloat(rsiMap[rsiDate].RSI) : null;

    // BBANDS(20) — Bollinger Bands (MACD is premium-only on Alpha Vantage free tier)
    const bbandsRaw = await rateLimitedFetch(
      `${API_BASE}?function=BBANDS&symbol=${avSymbol}&interval=daily&time_period=20&series_type=close&apikey=${key}`
    );
    bumpCallLog(`BBANDS/${avSymbol}`);
    const bbandsMap = bbandsRaw['Technical Analysis: BBANDS'];
    const bbandsDate = bbandsMap ? Object.keys(bbandsMap)[0] : null;
    const bbands = bbandsDate
      ? {
          upper: parseFloat(bbandsMap[bbandsDate]['Real Upper Band']),
          middle: parseFloat(bbandsMap[bbandsDate]['Real Middle Band']),
          lower: parseFloat(bbandsMap[bbandsDate]['Real Lower Band']),
        }
      : null;

    // SMA 50
    const sma50Raw = await rateLimitedFetch(
      `${API_BASE}?function=SMA&symbol=${avSymbol}&interval=daily&time_period=50&series_type=close&apikey=${key}`
    );
    bumpCallLog(`SMA50/${avSymbol}`);
    const sma50Map = sma50Raw['Technical Analysis: SMA'];
    const sma50Date = sma50Map ? Object.keys(sma50Map)[0] : null;
    const sma50 = sma50Date ? parseFloat(sma50Map[sma50Date].SMA) : null;

    // SMA 200
    const sma200Raw = await rateLimitedFetch(
      `${API_BASE}?function=SMA&symbol=${avSymbol}&interval=daily&time_period=200&series_type=close&apikey=${key}`
    );
    bumpCallLog(`SMA200/${avSymbol}`);
    const sma200Map = sma200Raw['Technical Analysis: SMA'];
    const sma200Date = sma200Map ? Object.keys(sma200Map)[0] : null;
    const sma200 = sma200Date ? parseFloat(sma200Map[sma200Date].SMA) : null;

    const result = { ticker: upperTicker, rsi, bbands, sma50, sma200, fetchedAt: new Date().toISOString() };

    // Only cache if at least one value came back — don't cache quota-exhausted responses
    if (rsi != null || bbands != null || sma50 != null || sma200 != null) {
      const entry = { data: result, fetchedAt: Date.now() };
      indicatorsMemCache[upperTicker] = entry;
      const allIndicators = readJson(INDICATORS_CACHE_FILE, {});
      allIndicators[upperTicker] = entry;
      writeJson(INDICATORS_CACHE_FILE, allIndicators);
    }

    return { ...result, dataSource: 'live', cacheAgeMin: 0 };
  } catch (err) {
    console.error(`[AlphaVantage] Technical data fetch failed for ${avSymbol}:`, err.message);
    const stale = memEntry ?? fileEntry;
    if (stale) {
      return { ...stale.data, dataSource: 'stale_cache', warning: '⚠️ Live data unavailable — showing last cached indicators' };
    }
    return { ticker: upperTicker, error: `Failed to fetch technical data: ${err.message}`, dataSource: 'error' };
  }
}

// ── Public: cache status ──────────────────────────────────────────────────────

export function getAvCacheStatus() {
  const fileCache = readJson(PRICE_CACHE_FILE, null);
  const cache = priceMemCache ?? fileCache;
  if (!cache) return { canRefresh: true, cacheAgeMin: null, callsRemaining: callsRemaining() };
  const age = Math.floor((Date.now() - cache.fetchedAt) / 60000);
  return { canRefresh: age >= 15, cacheAgeMin: age, callsRemaining: callsRemaining() };
}
