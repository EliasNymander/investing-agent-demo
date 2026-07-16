import https from 'https';
import { fxRates as staticRates } from '../data/mock-prices.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dirname, '../cache/fx-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ECB daily reference rates XML feed
const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

function loadCache() {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function saveCache(rates) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ rates, fetchedAt: new Date().toISOString() }, null, 2));
  } catch {}
}

function fetchXml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchEcbRates() {
  const xml = await fetchXml(ECB_URL);
  // ECB format: <Cube currency='USD' rate='1.0850'/> — parse with regex, no xml2js needed
  const rates = {};
  const re = /currency='([A-Z]{3})'\s+rate='([\d.]+)'/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    rates[m[1]] = parseFloat(m[2]);
  }
  return rates; // e.g. { USD: 1.085, SEK: 11.42, NOK: 11.78, GBP: 0.845, ... }
}

// Returns { EUR_USD, EUR_SEK, EUR_NOK, EUR_GBP, USD_EUR, SEK_EUR, NOK_EUR, GBP_EUR }
// Falls back to static rates from mock-prices.js on any failure.
export async function getLiveFxRates() {
  // Try cache first
  const cached = loadCache();
  if (cached?.fetchedAt) {
    const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
    if (ageMs < CACHE_TTL_MS) {
      return buildRateMap(cached.rates);
    }
  }

  try {
    const ecbRates = await fetchEcbRates();
    if (ecbRates.USD && ecbRates.SEK) {
      saveCache(ecbRates);
      return buildRateMap(ecbRates);
    }
  } catch (err) {
    console.warn('[fx-service] ECB fetch failed, using static rates:', err.message);
  }

  // Fallback: derive from static rates
  return {
    EUR_USD: staticRates.EUR_USD,
    EUR_SEK: staticRates.EUR_SEK,
    EUR_NOK: staticRates.EUR_NOK,
    EUR_GBP: staticRates.EUR_GBP,
    USD_EUR: staticRates.USD_EUR,
    SEK_EUR: staticRates.SEK_EUR,
    NOK_EUR: staticRates.NOK_EUR,
    GBP_EUR: staticRates.GBP_EUR,
  };
}

function buildRateMap(ecbRates) {
  const usd = ecbRates.USD ?? staticRates.EUR_USD;
  const sek = ecbRates.SEK ?? staticRates.EUR_SEK;
  const nok = ecbRates.NOK ?? staticRates.EUR_NOK;
  const gbp = ecbRates.GBP ?? staticRates.EUR_GBP;
  return {
    EUR_USD: usd,
    EUR_SEK: sek,
    EUR_NOK: nok,
    EUR_GBP: gbp,
    USD_EUR: 1 / usd,
    SEK_EUR: 1 / sek,
    NOK_EUR: 1 / nok,
    GBP_EUR: 1 / gbp,
  };
}

// Returns { dataSource, cacheAgeMin } for the system-status endpoint.
// Read-only — does not fetch, does not touch the cache file.
// dataSource: 'live'        — cache exists and is within the 24h TTL (an ECB fetch succeeded recently)
//             'stale_cache' — cache exists but is older than 24h (still real ECB data, just aged)
//             'mock'        — no cache file yet; getLiveFxRates() would be serving static fallback rates
export function getFxCacheStatus() {
  const cached = loadCache();
  if (!cached?.fetchedAt) return { dataSource: 'mock', cacheAgeMin: null };
  const ageMin = Math.floor((Date.now() - new Date(cached.fetchedAt).getTime()) / 60000);
  return {
    dataSource: ageMin < CACHE_TTL_MS / 60000 ? 'live' : 'stale_cache',
    cacheAgeMin: ageMin,
  };
}
