import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mockPrices } from '../data/mock-prices.js';
import { toEur } from '../utils/currency.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JOURNAL_PATH = resolve(__dirname, '..', '..', 'journal.json');

function loadJournal() {
  if (!existsSync(JOURNAL_PATH)) return [];
  try {
    return JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveJournal(entries) {
  writeFileSync(JOURNAL_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

function enrich(entry, allEntries) {
  const priceData = mockPrices[entry.ticker];
  const currentPrice = priceData?.price ?? null;
  const priceCurrency = priceData?.currency ?? entry.currency;
  const totalValueEur = toEur(entry.qty * entry.price, entry.currency);

  if (entry.action === 'SELL') {
    const linkedBuy = allEntries.find((e) => e.id === entry.linkedBuyId);
    let realizedPnlEur = null;
    let realizedPnlPct = null;
    let linkedBuyDate = null;
    if (linkedBuy) {
      realizedPnlPct = ((entry.price - linkedBuy.price) / linkedBuy.price) * 100;
      realizedPnlEur = toEur((entry.price - linkedBuy.price) * entry.qty, entry.currency);
      linkedBuyDate = linkedBuy.date;
    }
    return { ...entry, totalValueEur, realizedPnlEur, realizedPnlPct, linkedBuyDate, status: 'sell' };
  }

  // BUY entry — check if a SELL exists that closes this one
  const sellEntry = allEntries.find((e) => e.action === 'SELL' && e.linkedBuyId === entry.id);
  const isClosed = !!sellEntry;

  let currentValueEur = null;
  let unrealizedPnlEur = null;
  let unrealizedPnlPct = null;

  if (!isClosed && currentPrice !== null) {
    currentValueEur = toEur(entry.qty * currentPrice, priceCurrency);
    unrealizedPnlEur = currentValueEur - totalValueEur;
    unrealizedPnlPct = ((currentPrice - entry.price) / entry.price) * 100;
  }

  return {
    ...entry,
    totalValueEur,
    currentPrice: isClosed ? null : currentPrice,
    currentValueEur: isClosed ? null : currentValueEur,
    unrealizedPnlEur,
    unrealizedPnlPct,
    sellDate: sellEntry?.date ?? null,
    status: isClosed ? 'closed' : 'open',
  };
}

function computeStats(enriched) {
  const sells = enriched.filter((e) => e.action === 'SELL');
  const openBuys = enriched.filter((e) => e.action === 'BUY' && e.status === 'open');
  const wins = sells.filter((e) => (e.realizedPnlPct ?? 0) > 0).length;
  const totalUnrealizedPnlEur = openBuys.reduce((s, e) => s + (e.unrealizedPnlEur ?? 0), 0);
  const totalRealizedPnlEur = sells.reduce((s, e) => s + (e.realizedPnlEur ?? 0), 0);

  const sellsSorted = [...sells].sort((a, b) => (b.realizedPnlPct ?? 0) - (a.realizedPnlPct ?? 0));

  return {
    totalEntries: enriched.length,
    openPositions: openBuys.length,
    closedTrades: sells.length,
    winRate: sells.length > 0 ? Math.round((wins / sells.length) * 100) : 0,
    totalUnrealizedPnlEur,
    totalRealizedPnlEur,
    signalLinkedCount: enriched.filter((e) => e.signalRef !== null).length,
    bestTrade: sellsSorted[0]
      ? { ticker: sellsSorted[0].ticker, pnlPct: sellsSorted[0].realizedPnlPct }
      : null,
    worstTrade: sellsSorted.length > 0
      ? { ticker: sellsSorted[sellsSorted.length - 1].ticker, pnlPct: sellsSorted[sellsSorted.length - 1].realizedPnlPct }
      : null,
  };
}

export function getJournal() {
  const entries = loadJournal();
  const enriched = entries.map((e) => enrich(e, entries));
  return { entries: enriched, stats: computeStats(enriched) };
}

export function addEntry(data) {
  const entries = loadJournal();
  const qty = parseFloat(data.qty);
  const price = parseFloat(data.price);
  const newEntry = {
    id: `tj-${Date.now()}`,
    action: data.action,
    ticker: (data.ticker ?? '').toUpperCase(),
    name: data.name ?? '',
    assetClass: data.assetClass ?? 'stock',
    platform: data.platform ?? 'Other',
    currency: data.currency ?? 'USD',
    qty,
    price,
    totalValue: qty * price,
    date: data.date ?? new Date().toISOString(),
    reasoning: data.reasoning ?? '',
    confidence: parseInt(data.confidence, 10) || 3,
    signalRef: data.signalRef ?? null,
    linkedBuyId: data.linkedBuyId ?? null,
    tags: data.tags ?? [],
    createdAt: new Date().toISOString(),
  };
  entries.push(newEntry);
  saveJournal(entries);
  return enrich(newEntry, entries);
}

export function updateEntry(id, patch) {
  const entries = loadJournal();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...patch };
  saveJournal(entries);
  return enrich(entries[idx], entries);
}

export function deleteEntry(id) {
  const entries = loadJournal();
  const filtered = entries.filter((e) => e.id !== id);
  saveJournal(filtered);
  return true;
}
