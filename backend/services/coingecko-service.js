import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { mockPrices, fxRates } from '../data/mock-prices.js';
import { getCryptoIds } from '../config/holdings.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dir, '..', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'coingecko-cache.json');
const LOG_FILE = join(CACHE_DIR, 'api_call_log.json');
const PRICE_TTL_MS = 15 * 60 * 1000; // 15 min
const DAILY_LIMIT = 20;
const RETRY_DELAY_MS = 3000;
const API_BASE = 'https://api.coingecko.com/api/v3';

export function getCryptoIdMap() { return getCryptoIds(); }

// in-memory cache (survives individual requests within the same server process)
let memCache = null;

// ── File helpers ────────────────────────────────────────────────────────────

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

// ── Daily call log ──────────────────────────────────────────────────────────

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

// ── Cache helpers ───────────────────────────────────────────────────────────

function cacheAgeMin(cache) {
  if (!cache) return null;
  return Math.floor((Date.now() - cache.fetchedAt) / 60000);
}

function isValid(cache) {
  return cache != null && Date.now() - cache.fetchedAt < PRICE_TTL_MS;
}

// ── Mock fallback (EUR) ─────────────────────────────────────────────────────
// Converts mock USD prices → EUR using the mock FX rate so the shape matches
// what a live CoinGecko response looks like.

function buildMockPrices() {
  const out = {};
  for (const [ticker, geckoId] of Object.entries(getCryptoIds())) {
    const mp = mockPrices[ticker];
    out[geckoId] = {
      eur: mp ? +(mp.price * fxRates.USD_EUR).toFixed(2) : 0,
      eur_24h_change: mp ? mp.dailyPct : 0,
    };
  }
  return out;
}

// ── Live API call ───────────────────────────────────────────────────────────

async function fetchFromApi() {
  const ids = Object.values(getCryptoIds()).join(',');
  const key = config.apiKeys.coinGecko;
  const url = `${API_BASE}/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`;

  const resp = await fetch(url, {
    headers: { 'x-cg-demo-api-key': key, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (resp.status === 429) {
    const err = new Error('RATE_LIMIT');
    err.status = 429;
    throw err;
  }
  if (!resp.ok) throw new Error(`API_ERROR_${resp.status}`);
  return resp.json();
}

async function fetchWithRetry() {
  try {
    return await fetchFromApi();
  } catch (err) {
    if (err.status === 429) throw err;
    // Single retry after 3 s for transient network errors
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return fetchFromApi();
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns { prices, dataSource, cacheAgeMin, warning, dailyLimitReached }.
 * prices shape: { bitcoin: { eur, eur_24h_change }, ... }
 * dataSource: 'live' | 'stale_cache' | 'mock'
 */
export async function getCryptoPrices() {
  // 1. Warm in-memory cache hit
  if (isValid(memCache)) {
    return {
      prices: memCache.prices,
      dataSource: 'live',
      cacheAgeMin: cacheAgeMin(memCache),
      warning: null,
      dailyLimitReached: false,
    };
  }

  // 2. Check daily limit
  const callLog = loadCallLog();
  if (callLog.count >= DAILY_LIMIT) {
    const fileCache = readJson(CACHE_FILE, null);
    const best = memCache ?? fileCache;
    return {
      prices: best?.prices ?? buildMockPrices(),
      dataSource: best ? 'stale_cache' : 'mock',
      cacheAgeMin: cacheAgeMin(best),
      warning: '⚠️ Daily data limit reached — showing last cached prices. Live prices will resume tomorrow.',
      dailyLimitReached: true,
    };
  }

  // 3. Try live API
  try {
    const data = await fetchWithRetry();
    const entry = { prices: data, fetchedAt: Date.now() };
    memCache = entry;
    writeJson(CACHE_FILE, entry);
    bumpCallLog('/simple/price');

    return {
      prices: data,
      dataSource: 'live',
      cacheAgeMin: 0,
      warning: null,
      dailyLimitReached: false,
    };
  } catch (err) {
    const isRateLimit = err.status === 429;
    bumpCallLog(isRateLimit ? '/simple/price (429)' : '/simple/price (error)');
    console.error(`[CoinGecko] ${err.message} — serving cached/mock data`);

    // Prefer fresh-from-disk cache if mem-cache is missing
    const fileCache = readJson(CACHE_FILE, null);
    const stale = memCache ?? fileCache;

    if (stale) {
      if (!memCache) memCache = stale; // warm mem-cache from disk
      return {
        prices: stale.prices,
        dataSource: 'stale_cache',
        cacheAgeMin: cacheAgeMin(stale),
        warning: `⚠️ Live data unavailable — showing last known prices`,
        dailyLimitReached: false,
      };
    }

    return {
      prices: buildMockPrices(),
      dataSource: 'mock',
      cacheAgeMin: null,
      warning: '⚠️ Live data unavailable — showing last known prices',
      dailyLimitReached: false,
    };
  }
}

/**
 * Returns { canRefresh, cacheAgeMin } for the frontend cooldown check.
 * canRefresh = true if cache is absent or older than 15 minutes.
 */
export function getCacheStatus() {
  const fileCache = readJson(CACHE_FILE, null);
  const cache = memCache ?? fileCache;
  if (!cache) return { canRefresh: true, cacheAgeMin: null };
  const age = cacheAgeMin(cache);
  return { canRefresh: age >= 15, cacheAgeMin: age };
}

/** Force-expire the in-memory cache (called when a valid manual refresh fires). */
export function invalidateCache() {
  memCache = null;
}
