import { getAllHoldings } from '../config/holdings.js';
import { isDemoMode } from '../config/demo-mode.js';
import { getAvCacheStatus } from './alphavantage-service.js';
import { getCacheStatus as getCoinGeckoCacheStatus } from './coingecko-service.js';
import { getFundCacheStatus } from './yahoo-finance-service.js';
import { getFxCacheStatus } from './fx-service.js';

// Mirrors the isin-first routing analytics-service.js actually uses (a holding with an
// ISIN resolves via Yahoo even if assetClass is 'etf'/'stock'), so "active
// provider" reflects where each holding's price truly comes from, not just its assetClass.
function determineActiveProviders(holdings) {
  const active = new Set();
  for (const h of holdings) {
    if (h.assetClass === 'crypto') { active.add('coinGecko'); continue; }
    if (h.isin) { active.add('yahoo'); continue; }
    if (h.assetClass === 'stock' || h.assetClass === 'etf') active.add('alphaVantage');
  }
  if (holdings.some(h => h.currency && h.currency !== 'EUR')) active.add('fx');
  return active;
}

// Read-only: derives a dataSource label from a service's own { canRefresh, cacheAgeMin }
// shape. canRefresh is already computed by that service against its own TTL, so reusing it
// avoids re-declaring a duplicate TTL constant here that could drift from the real one.
function dataSourceFromCacheStatus({ canRefresh, cacheAgeMin }) {
  if (cacheAgeMin == null) return 'mock';
  return canRefresh ? 'stale_cache' : 'live';
}

function safeCheck(fn) {
  try { return fn(); }
  catch (err) {
    console.error('[system-status] provider check failed:', err.message);
    return 'error';
  }
}

export function getSystemStatus() {
  const holdings = getAllHoldings(); // already scoped to the active account
  const demoMode = isDemoMode();
  const active = determineActiveProviders(holdings);

  const providers = {};
  if (active.has('alphaVantage'))
    providers.alphaVantage = safeCheck(() => dataSourceFromCacheStatus(getAvCacheStatus()));
  if (active.has('coinGecko'))
    providers.coinGecko = safeCheck(() => dataSourceFromCacheStatus(getCoinGeckoCacheStatus()));
  if (active.has('yahoo'))
    providers.yahoo = safeCheck(() => getFundCacheStatus().dataSource);
  if (active.has('fx'))
    providers.fx = safeCheck(() => getFxCacheStatus().dataSource);

  const states = Object.values(providers);
  let verdict;
  if (demoMode)                              verdict = 'mock';
  else if (states.length === 0)              verdict = 'mock';
  else if (states.every(s => s === 'mock'))  verdict = 'mock';
  else if (states.every(s => s === 'live'))  verdict = 'live';
  else                                        verdict = 'partial';

  return { verdict, demoMode, providers, generatedAt: new Date().toISOString() };
}
