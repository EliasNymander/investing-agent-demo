import { mockPrices, fxRates as staticFxRates } from '../data/mock-prices.js';
import { getFlag } from '../utils/flag-calculator.js';
import { getCryptoPrices } from './coingecko-service.js';
import { getStockPrices } from './alphavantage-service.js';
import { getAllFundPrices } from './yahoo-finance-service.js';
import { getHoldings, getCryptoIds } from '../config/holdings.js';
import { getLiveFxRates } from './fx-service.js';

// Convert CoinGecko EUR prices → mockPrices shape.
// EUR→USD keeps enrichHolding logic (prices in holding's native currency) intact.
function buildLiveCryptoPrices(geckoData, geckoIds, rates) {
  const out = {};
  for (const [ticker, geckoId] of Object.entries(geckoIds)) {
    const live = geckoData[geckoId];
    if (live) {
      out[ticker] = {
        price: +(live.eur * rates.EUR_USD).toFixed(2),
        dailyPct: live.eur_24h_change ?? 0,
        currency: 'USD',
        updatedAt: new Date().toISOString(),
        dataSource: 'CoinGecko',
      };
    }
  }
  return out;
}

// Normalize Yahoo Finance prices for ISIN-mapped funds/ETFs.
// Keyed by holding.ticker so enrichHolding picks them up transparently.
function buildLiveFundPrices(fundPrices, allHoldings) {
  const out = {};
  for (const holding of allHoldings) {
    if (!holding.isin) continue;
    if (holding.assetClass !== 'fund' && holding.assetClass !== 'etf') continue;
    const entry = fundPrices[holding.isin];
    if (!entry?.price) continue;
    out[holding.ticker] = {
      price:      entry.price,
      dailyPct:   entry.dailyPct ?? 0,
      currency:   entry.currency ?? holding.currency,
      updatedAt:  entry.timestamp,
      dataSource: entry.cached ? 'yahoo_cached' : 'yahoo',
      isNav: true,
    };
  }
  return out;
}

// Normalize Alpha Vantage prices: changePct → dailyPct.
function buildLiveStockPrices(avPrices) {
  const out = {};
  for (const [ticker, data] of Object.entries(avPrices)) {
    if (!data) continue;
    out[ticker] = {
      price: data.price,
      dailyPct: data.changePct ?? 0,
      currency: data.currency ?? 'USD',
      prevClose: data.prevClose ?? null,
      updatedAt: data.latestTradingDay ?? new Date().toISOString(),
      dataSource: data.dataSource,
    };
  }
  return out;
}

function toEur(amount, currency, rates) {
  switch (currency) {
    case 'EUR': return amount;
    case 'USD': return amount * rates.USD_EUR;
    case 'SEK': return amount * rates.SEK_EUR;
    case 'NOK': return amount * rates.NOK_EUR;
    case 'GBP': return amount * rates.GBP_EUR;
    default:    return amount;
  }
}

function enrichHolding(holding, prices, rates) {
  const price = prices[holding.ticker];
  if (!price) return null;

  const units = holding.units ?? 0;
  const currentPrice = price.price;
  const marketValue = units * currentPrice;
  const costBasis = units * holding.avgCost;
  const plAbs = marketValue - costBasis;
  const plPct = holding.avgCost > 0
    ? ((currentPrice - holding.avgCost) / holding.avgCost) * 100
    : 0;
  const marketValueEur = toEur(marketValue, holding.currency, rates);
  const costBasisEur = toEur(costBasis, holding.currency, rates);
  const plAbsEur = toEur(plAbs, holding.currency, rates);
  const flag = getFlag(price.dailyPct, holding.assetClass);

  return {
    ...holding,
    currentPrice,
    dailyPct: price.dailyPct,
    marketValue,
    marketValueEur,
    costBasis,
    costBasisEur,
    plAbs,
    plAbsEur,
    plPct,
    flag,
    updatedAt: price.updatedAt,
    ...(price.dataSource ? { dataSource: price.dataSource } : {}),
    ...(price.isNav ? { isNav: true } : {}),
  };
}

export async function getPortfolio() {
  const holdings = getHoldings();
  const geckoIds = getCryptoIds();

  const allHoldingsFlat = [
    ...(holdings.nordnet ?? []),
    ...(holdings.nordea  ?? []),
    ...(holdings.kvarnx  ?? []),
  ];

  if (allHoldingsFlat.length === 0) {
    return {
      isEmpty: true,
      hasConfiguredHoldings: false,
      configuredCount: 0,
      summary: {
        totalValueEur: 0,
        totalCostEur: 0,
        totalPlEur: 0,
        totalPlPct: 0,
        dayPlEur: 0,
        holdingCount: 0,
        flaggedCount: 0,
        generatedAt: new Date().toISOString(),
      },
      platforms: { nordnet: [], nordea: [], kvarnx: [] },
      flaggedHoldings: [],
      cryptoMeta: { dataSource: 'none', cacheAgeMin: null, warning: null, dailyLimitReached: false },
      stockMeta:  { dataSource: 'none', cacheAgeMin: null, warning: null, dailyLimitReached: false },
    };
  }

  const [cryptoResult, stockResult, fundPrices, fxRates] = await Promise.all([
    getCryptoPrices(),
    getStockPrices(),
    getAllFundPrices(),
    getLiveFxRates(),
  ]);

  const liveCryptoPrices = buildLiveCryptoPrices(cryptoResult.prices, geckoIds, fxRates);
  const liveStockPrices  = buildLiveStockPrices(stockResult.prices);
  const liveFundPrices   = buildLiveFundPrices(fundPrices, allHoldingsFlat);

  // Priority: mock (lowest) → stocks → funds → crypto (highest, real-time)
  const prices = { ...mockPrices, ...liveStockPrices, ...liveFundPrices, ...liveCryptoPrices };

  const platforms = {
    nordnet: (holdings.nordnet ?? []).map((h) => enrichHolding(h, prices, fxRates)).filter(Boolean),
    nordea:  (holdings.nordea  ?? []).map((h) => enrichHolding(h, prices, fxRates)).filter(Boolean),
    kvarnx:  (holdings.kvarnx  ?? []).map((h) => enrichHolding(h, prices, fxRates)).filter(Boolean),
  };

  const enriched = [...platforms.nordnet, ...platforms.nordea, ...platforms.kvarnx];
  const isEmpty = enriched.length === 0;

  const totalValueEur = enriched.reduce((s, h) => s + h.marketValueEur, 0);
  const totalCostEur  = enriched.reduce((s, h) => s + h.costBasisEur, 0);
  const totalPlEur    = totalValueEur - totalCostEur;
  const totalPlPct    = totalCostEur > 0
    ? ((totalValueEur - totalCostEur) / totalCostEur) * 100
    : 0;

  // dayPlEur derived from marketValueEur and dailyPct — no unit/currency re-calc needed
  const dayPlEur = enriched.reduce((sum, h) => {
    if (h.dailyPct === 0) return sum;
    const prevValueEur = h.marketValueEur / (1 + h.dailyPct / 100);
    return sum + (h.marketValueEur - prevValueEur);
  }, 0);

  const flaggedHoldings = enriched.filter((h) => h.flag.active);

  return {
    isEmpty,
    hasConfiguredHoldings: allHoldingsFlat.length > 0,
    configuredCount: allHoldingsFlat.length,
    summary: {
      totalValueEur,
      totalCostEur,
      totalPlEur,
      totalPlPct,
      dayPlEur,
      holdingCount: enriched.length,
      flaggedCount: flaggedHoldings.length,
      generatedAt: new Date().toISOString(),
    },
    platforms,
    flaggedHoldings,
    cryptoMeta: {
      dataSource:        cryptoResult.dataSource,
      cacheAgeMin:       cryptoResult.cacheAgeMin,
      warning:           cryptoResult.warning,
      dailyLimitReached: cryptoResult.dailyLimitReached,
    },
    stockMeta: {
      dataSource:        stockResult.dataSource,
      cacheAgeMin:       stockResult.cacheAgeMin,
      warning:           stockResult.warning,
      dailyLimitReached: stockResult.dailyLimitReached,
    },
  };
}
