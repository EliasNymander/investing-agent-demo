import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dir, '..', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'yahoo-fund-cache.json');
const CACHE_TTL_MS = 30 * 60 * 1000;

const FUND_SYMBOLS = {
  'IE00BMTD2M99': '0P0001K6NE.F',
  'IE00BMTD2H47': '0P0001K6NI.F',
  'IE00BNNLSL70': '0P0001M5YP.F',
  'IE00BMTD2W97': '0P0001K6NM.F',
  'SE0006800140': '0P00015D8I.F',
  'SE0004297927': '0P0000ULAP.ST',
  'IE00BQN1K562': 'CEMQ.DE',
  'FI0008801451': '0P00000NMR.F',
  'FI4000261300': '0P0001CKSS.F',
};

// v8/finance/quote requires crumb auth and is unreliable — use per-symbol chart endpoint instead.
// chart endpoint returns 200 without auth and includes regularMarketPrice + chartPreviousClose.
const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

let memCache = null;
let refreshInProgress = false;

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

async function fetchSymbol(isin, symbol) {
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Yahoo Finance HTTP ${resp.status} for ${symbol}`);
  const json = await resp.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error(`No price in response for ${symbol}`);
  const prev = meta.chartPreviousClose ?? meta.regularMarketPrice;
  const dailyPct = prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0;
  return {
    price:     meta.regularMarketPrice,
    currency:  meta.currency ?? null,
    dailyPct:  +dailyPct.toFixed(4),
    symbol,
    isin,
    timestamp: new Date().toISOString(),
  };
}

async function fetchFromYahoo() {
  const prices = {};
  for (const [isin, symbol] of Object.entries(FUND_SYMBOLS)) {
    try {
      prices[isin] = await fetchSymbol(isin, symbol);
    } catch (err) {
      console.error('[YahooFinance] Symbol fetch failed:', err.message);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return prices;
}

async function refreshInBackground() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    const prices = await fetchFromYahoo();
    memCache = { prices, fetchedAt: Date.now() };
    writeJson(CACHE_FILE, memCache);
    console.log('[YahooFinance] Background refresh complete');
  } catch (err) {
    console.error('[YahooFinance] Background refresh failed:', err.message);
  } finally {
    refreshInProgress = false;
  }
}

async function getCachedPrices() {
  const now = Date.now();

  // 1. Fresh memory cache
  if (memCache && now - memCache.fetchedAt < CACHE_TTL_MS) {
    return { prices: memCache.prices, cached: false };
  }

  // 2. Stale memory cache — return immediately, refresh in background
  if (memCache) {
    refreshInBackground();
    return { prices: memCache.prices, cached: true };
  }

  // 3. File cache
  const fileCache = readJson(CACHE_FILE, null);
  if (fileCache) {
    memCache = fileCache;
    const stale = now - fileCache.fetchedAt >= CACHE_TTL_MS;
    if (stale) refreshInBackground();
    return { prices: fileCache.prices, cached: stale };
  }

  // 4. No cache — first call, fetch synchronously
  try {
    const prices = await fetchFromYahoo();
    memCache = { prices, fetchedAt: Date.now() };
    writeJson(CACHE_FILE, memCache);
    return { prices, cached: false };
  } catch (err) {
    console.error('[YahooFinance] Initial fetch failed:', err.message);
    return { prices: {}, cached: false };
  }
}

// Returns { price, currency, dailyPct, symbol, isin, cached, timestamp }
// or { price: null, error: '...' } — never throws
export async function getFundPrice(isin) {
  if (!FUND_SYMBOLS[isin]) {
    return { price: null, error: `No Yahoo Finance symbol mapped for ISIN ${isin}`, isin };
  }
  try {
    const { prices, cached } = await getCachedPrices();
    const entry = prices[isin];
    if (!entry?.price) {
      return { price: null, error: 'Price not returned by Yahoo Finance', isin, symbol: FUND_SYMBOLS[isin] };
    }
    return { ...entry, cached };
  } catch (err) {
    return { price: null, error: err.message, isin };
  }
}

// Watchlist-only tickers not in the portfolio (XETRA ETFs).
// Add new non-portfolio tickers here; the watchlist service picks them up automatically.
export const WATCHLIST_TICKER_SYMBOLS = {};

const tickerMemCache = {};

// Returns { price, currency, dailyPct, symbol, ticker, cached }
// or { price: null, error: '...' } — never throws
export async function getTickerPrice(ticker) {
  const symbol = WATCHLIST_TICKER_SYMBOLS[ticker];
  if (!symbol) return { price: null, error: `No Yahoo symbol mapped for ticker ${ticker}`, ticker };
  const now = Date.now();
  const entry = tickerMemCache[ticker];
  if (entry && now - entry.fetchedAt < CACHE_TTL_MS) return { ...entry.data, cached: true };
  try {
    const data = await fetchSymbol(ticker, symbol);
    tickerMemCache[ticker] = { data, fetchedAt: now };
    return { ...data, cached: false };
  } catch (err) {
    return { price: null, error: err.message, ticker, symbol };
  }
}

// Returns map of isin → result. Uses Promise.allSettled — a single symbol
// failure never blocks the rest. Underlying HTTP call is one batched request.
export async function getAllFundPrices() {
  const { prices, cached } = await getCachedPrices();

  const settled = await Promise.allSettled(
    Object.keys(FUND_SYMBOLS).map(async (isin) => {
      const entry = prices[isin];
      if (!entry?.price) {
        return { isin, price: null, error: 'Price not returned by Yahoo Finance',
                 symbol: FUND_SYMBOLS[isin] };
      }
      return { ...entry, cached };
    })
  );

  const map = {};
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      map[result.value.isin] = result.value;
    } else {
      console.error('[YahooFinance] Unexpected allSettled rejection:', result.reason);
    }
  }
  return map;
}

// Returns { dataSource, cacheAgeMin } for the system-status endpoint.
// Read-only — does not fetch, does not touch memCache or the cache file.
// dataSource: 'live' (fresh, no failed ISINs), 'stale_cache' (aged, no failed ISINs),
// 'error' (at least one ISIN has no price — funds have no mock fallback),
// 'mock' (no cache has ever been written).
export function getFundCacheStatus() {
  const cache = memCache ?? readJson(CACHE_FILE, null);
  if (!cache) return { dataSource: 'mock', cacheAgeMin: null };
  const ageMin = Math.floor((Date.now() - cache.fetchedAt) / 60000);
  const entries = Object.values(cache.prices ?? {});
  const anyFailed = entries.some(e => !e?.price);
  if (anyFailed) return { dataSource: 'error', cacheAgeMin: ageMin };
  return { dataSource: ageMin < CACHE_TTL_MS / 60000 ? 'live' : 'stale_cache', cacheAgeMin: ageMin };
}
