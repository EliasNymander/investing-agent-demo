import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getStockPrices } from './alphavantage-service.js';
import { getCryptoPrices } from './coingecko-service.js';
import { getCryptoIds } from '../config/holdings.js';
import { getTickerPrice, WATCHLIST_TICKER_SYMBOLS } from './yahoo-finance-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WATCHLIST_PATH = resolve(__dirname, '..', '..', 'watchlist.json');

function load() {
  if (!existsSync(WATCHLIST_PATH)) return [];
  try {
    return JSON.parse(readFileSync(WATCHLIST_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function save(items) {
  writeFileSync(WATCHLIST_PATH, JSON.stringify(items, null, 2), 'utf8');
}

function checkAlerts(item, currentPrice) {
  if (!item.alerts) return item.alerts;
  return item.alerts.map((alert) => ({
    ...alert,
    triggered:
      currentPrice != null && (
        (alert.condition === 'below' && currentPrice <= alert.targetPrice) ||
        (alert.condition === 'above' && currentPrice >= alert.targetPrice)
      ),
  }));
}

async function fetchPrices() {
  const geckoMap = getCryptoIds();
  const watchlistTickers = Object.keys(WATCHLIST_TICKER_SYMBOLS);
  const [stockResult, cryptoResult, ...yahooArr] = await Promise.all([
    getStockPrices(),
    getCryptoPrices(),
    ...watchlistTickers.map(t => getTickerPrice(t).then(r => [t, r])),
  ]);
  const yahooResult = Object.fromEntries(
    yahooArr.filter(([, r]) => r.price != null)
  );
  return { stockResult, cryptoResult, geckoMap, yahooResult };
}

function enrich(item, stockResult, cryptoResult, geckoMap, yahooResult = {}) {
  let currentPrice = null;
  let dailyPct = null;
  let currency = item.currency;

  if (item.assetClass === 'crypto') {
    const gid = geckoMap[item.ticker];
    const data = gid ? cryptoResult?.prices?.[gid] : null;
    if (data?.eur) {
      currentPrice = data.eur;
      dailyPct = data.eur_24h_change ?? null;
      currency = 'EUR';
    }
  } else {
    const data = stockResult?.prices?.[item.ticker];
    if (data) {
      currentPrice = data.eur ?? data.price ?? null;
      dailyPct = data.changePct ?? null;
      currency = data.currency ?? item.currency;
    }
    // Fallback to Yahoo Finance for non-portfolio tickers (e.g. XETRA ETFs)
    if (currentPrice == null && yahooResult[item.ticker]) {
      const yData = yahooResult[item.ticker];
      currentPrice = yData.price ?? null;
      dailyPct = yData.dailyPct ?? null;
      currency = yData.currency ?? item.currency;
    }
  }

  const priceSinceAdded =
    currentPrice != null && item.addedPrice != null
      ? ((currentPrice - item.addedPrice) / item.addedPrice) * 100
      : null;

  return {
    ...item,
    currentPrice,
    dailyPct,
    currency,
    priceSinceAdded,
    alerts: checkAlerts(item, currentPrice),
    hasTriggeredAlerts:
      currentPrice != null &&
      (item.alerts?.some(
        (a) =>
          (a.condition === 'below' && currentPrice <= a.targetPrice) ||
          (a.condition === 'above' && currentPrice >= a.targetPrice)
      ) ?? false),
  };
}

export async function getWatchlist() {
  const items = load();
  if (!items.length) return [];
  const { stockResult, cryptoResult, geckoMap, yahooResult } = await fetchPrices();
  return items.map((item) => enrich(item, stockResult, cryptoResult, geckoMap, yahooResult));
}

export async function addToWatchlist(item) {
  const items = load();
  const { stockResult, cryptoResult, geckoMap, yahooResult } = await fetchPrices();

  const ticker = item.ticker.toUpperCase();
  const assetClass = item.assetClass ?? 'stock';

  let addedPrice = null;
  if (assetClass === 'crypto') {
    const gid = geckoMap[ticker];
    const data = gid ? cryptoResult?.prices?.[gid] : null;
    addedPrice = data?.eur ?? null;
  } else {
    const data = stockResult?.prices?.[ticker];
    addedPrice = data?.eur ?? data?.price ?? null;
    if (addedPrice == null && yahooResult[ticker]) {
      addedPrice = yahooResult[ticker].price ?? null;
    }
  }

  const newItem = {
    id: `wl-${Date.now()}`,
    ticker,
    name: item.name,
    exchange: item.exchange ?? '',
    assetClass,
    currency: item.currency ?? 'USD',
    addedAt: new Date().toISOString(),
    addedPrice,
    notes: item.notes ?? '',
    alerts: [],
  };
  items.push(newItem);
  save(items);
  return enrich(newItem, stockResult, cryptoResult, geckoMap, yahooResult);
}

export async function updateWatchlistItem(id, patch) {
  const items = load();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch };
  save(items);
  const { stockResult, cryptoResult, geckoMap, yahooResult } = await fetchPrices();
  return enrich(items[idx], stockResult, cryptoResult, geckoMap, yahooResult);
}

export function removeFromWatchlist(id) {
  const items = load();
  const filtered = items.filter((i) => i.id !== id);
  save(filtered);
  return true;
}

export async function addAlert(id, alert) {
  const items = load();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const newAlert = {
    id: `a-${Date.now()}`,
    condition: alert.condition,
    targetPrice: parseFloat(alert.targetPrice),
    label: alert.label ?? '',
    triggered: false,
    createdAt: new Date().toISOString(),
  };
  items[idx].alerts = [...(items[idx].alerts ?? []), newAlert];
  save(items);
  const { stockResult, cryptoResult, geckoMap, yahooResult } = await fetchPrices();
  return enrich(items[idx], stockResult, cryptoResult, geckoMap, yahooResult);
}

export async function removeAlert(id, alertId) {
  const items = load();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx].alerts = (items[idx].alerts ?? []).filter((a) => a.id !== alertId);
  save(items);
  const { stockResult, cryptoResult, geckoMap, yahooResult } = await fetchPrices();
  return enrich(items[idx], stockResult, cryptoResult, geckoMap, yahooResult);
}

export function getWatchlistTickers() {
  return load().map((item) => item.ticker);
}
