import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mockSignals } from '../data/mock-signals.js';
import { getCryptoPrices } from './coingecko-service.js';
import { getHoldings, getAllHoldings, getCryptoIds } from '../config/holdings.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const LATEST_DAILY = join(__dir, '..', 'generated', 'latest-daily.json');

// Maps signalUpdates from the daily briefing to the signal card format.
// Falls back to null if the file is missing, empty, or malformed.
function loadBriefingSignals(allHoldings) {
  try {
    if (!existsSync(LATEST_DAILY)) return null;
    const raw = JSON.parse(readFileSync(LATEST_DAILY, 'utf-8'));
    const updates = raw?.signalUpdates;
    if (!Array.isArray(updates) || updates.length === 0) return null;

    const h = getHoldings();
    const platformMap = {};
    for (const [label, list] of [['Nordnet', h.nordnet], ['Nordea', h.nordea], ['KvarnX', h.kvarnx]]) {
      for (const holding of (list ?? [])) { platformMap[holding.ticker] = label; }
    }
    const holdingMeta = Object.fromEntries(allHoldings.map(h => [h.ticker, h]));
    const generatedAt = raw.generatedAt ?? new Date().toISOString();

    const mapped = updates
      .filter(u => u.ticker && u.action)
      .map(u => ({
        id:                `daily-${u.ticker}`,
        type:              u.action.toUpperCase(),
        ticker:            u.ticker,
        name:              holdingMeta[u.ticker]?.name ?? u.ticker,
        platform:          platformMap[u.ticker] ?? '',
        assetClass:        holdingMeta[u.ticker]?.assetClass ?? 'stock',
        reasoning:         u.reasoning ?? '',
        trigger:           u.change ?? null,
        upside:            null,
        risk:              null,
        riskNote:          null,
        timeHorizon:       null,
        recommendedAction: null,
        generatedAt,
        source:            'daily_briefing',
      }));

    // Dedup by ticker — last occurrence wins if Claude emits duplicates
    const signals = [...new Map(mapped.map(s => [s.ticker, s])).values()];
    return { signals, generatedAt };
  } catch { return null; }
}

const TYPE_ORDER = { BUY: 0, SELL: 1, WATCH: 2 };

export async function getSignals(filterType) {
  // Fresh holdings on every call — reflects demo mode and user config changes
  const allHoldings = getAllHoldings();
  const heldTickers = new Set(allHoldings.map(h => h.ticker).filter(Boolean));

  // No holdings in real mode — return empty rather than leaking mock signals
  if (heldTickers.size === 0) {
    return {
      signals: [],
      counts: { BUY: 0, SELL: 0, WATCH: 0 },
      cryptoMeta: { dataSource: 'none', cacheAgeMin: null, warning: null },
      generatedAt: new Date().toISOString(),
    };
  }

  // Fresh geckoToTicker from current holdings — picks up demo mode
  const geckoToTicker = Object.fromEntries(
    Object.entries(getCryptoIds()).map(([ticker, id]) => [id, ticker])
  );

  const cryptoResult = await getCryptoPrices();

  // Build live price lookup: ticker → { priceEur, dailyPct }
  const livePrices = {};
  for (const [geckoId, data] of Object.entries(cryptoResult.prices)) {
    const ticker = geckoToTicker[geckoId];
    if (ticker) {
      livePrices[ticker] = {
        priceEur: data.eur,
        dailyPct: data.eur_24h_change ?? 0,
      };
    }
  }

  // Prefer live briefing signals over mock; both paths then get crypto enrichment
  const briefingResult      = loadBriefingSignals(allHoldings);
  const baseSignals         = briefingResult?.signals ?? mockSignals;
  const signalSource        = briefingResult ? 'daily_briefing' : 'mock';
  const briefingGeneratedAt = briefingResult?.generatedAt ?? null;
  let signals = baseSignals
    .filter(s => heldTickers.has(s.ticker))
    .map((s) => {
      if (s.assetClass === 'crypto' && livePrices[s.ticker]) {
        return {
          ...s,
          livePriceEur:   livePrices[s.ticker].priceEur,
          liveDailyPct:   livePrices[s.ticker].dailyPct,
          liveDataSource: cryptoResult.dataSource,
        };
      }
      return s;
    });

  if (filterType) {
    const upper = filterType.toUpperCase();
    signals = signals.filter((s) => s.type === upper);
  }
  signals.sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99));

  // Counts over the full holdings-scoped set (before filterType narrowing)
  const allHoldingsSignals = baseSignals.filter(s => heldTickers.has(s.ticker));
  return {
    signals,
    counts: {
      BUY:   allHoldingsSignals.filter((s) => s.type === 'BUY').length,
      SELL:  allHoldingsSignals.filter((s) => s.type === 'SELL').length,
      WATCH: allHoldingsSignals.filter((s) => s.type === 'WATCH').length,
    },
    cryptoMeta: {
      dataSource:  cryptoResult.dataSource,
      cacheAgeMin: cryptoResult.cacheAgeMin,
      warning:     cryptoResult.warning,
    },
    generatedAt: briefingGeneratedAt,
    source:      signalSource,
  };
}
