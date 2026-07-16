import { getAllHoldings, getCryptoIds } from '../config/holdings.js';
import { getStockPrices } from './alphavantage-service.js';
import { getCryptoPrices } from './coingecko-service.js';
import { getAllFundPrices } from './yahoo-finance-service.js';
import { getLiveFxRates } from './fx-service.js';

// Known ticker metadata — covers common holdings; unknown tickers fall back to resolveTickerMeta()
const TICKER_META = {
  IWDA:               { region: 'Global', sector: 'Diversified'  },
  ASML:               { region: 'Europe', sector: 'Technology'   },
  VWCE:               { region: 'Global', sector: 'Diversified'  },
  'NOVO-B':           { region: 'Europe', sector: 'Healthcare'   },
  SHEL:               { region: 'Europe', sector: 'Energy'       },
  'VOLV-B':           { region: 'Nordic', sector: 'Industrials'  },
  'NORDEA-STABLE':    { region: 'Nordic', sector: 'Diversified'  },
  'NORDEA-NORDIC-SC': { region: 'Nordic', sector: 'Diversified'  },
  BTC:                { region: 'Crypto', sector: 'Crypto'       },
  ADA:                { region: 'Crypto', sector: 'Crypto'       },
  DOT:                { region: 'Crypto', sector: 'Crypto'       },
  SPOT:               { region: 'Europe', sector: 'Technology'   },
  EQNR:               { region: 'Nordic', sector: 'Energy'       },
  KNEBV:              { region: 'Nordic', sector: 'Industrials'  },
};

// Fallback for tickers not in TICKER_META — derives region/sector from assetClass
function resolveTickerMeta(h) {
  if (TICKER_META[h.ticker]) return TICKER_META[h.ticker];
  if (h.assetClass === 'crypto') return { region: 'Crypto',  sector: 'Crypto'      };
  if (h.assetClass === 'etf')    return { region: 'Global',  sector: 'Diversified' };
  if (h.assetClass === 'fund')   return { region: 'Global',  sector: 'Diversified' };
  if (h.assetClass === 'bond')   return { region: 'Europe',  sector: 'Fixed Income'};
  return { region: 'Unknown', sector: 'Unknown' };
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

function toBreakdownGroups(map, totalEur) {
  return Object.entries(map)
    .map(([name, value]) => ({
      name,
      value: +value.toFixed(2),
      pct: +((value / totalEur) * 100).toFixed(1),
    }))
    .sort((a, b) => b.value - a.value);
}

// Resolves a holding's current price + native currency across all three live sources.
function resolveCurrentPrice(h, stockResult, cryptoResult, fundPrices, geckoMap) {
  if (h.assetClass === 'crypto') {
    const gid  = geckoMap[h.ticker];
    const data = gid ? cryptoResult.prices?.[gid] : null;
    return data?.eur ? { price: data.eur, currency: 'EUR' } : null;
  }
  if (h.isin && fundPrices[h.isin]?.price) {
    const entry = fundPrices[h.isin];
    return { price: entry.price, currency: entry.currency ?? h.currency };
  }
  const data = stockResult.prices?.[h.ticker];
  return data?.price ? { price: data.price, currency: data.currency ?? h.currency } : null;
}

export async function getAnalytics() {
  const holdings = getAllHoldings();
  if (!holdings.length) return null;

  const geckoMap = getCryptoIds(); // { ticker → geckoId }
  const [stockResult, cryptoResult, fundPrices, rates] = await Promise.all([
    getStockPrices(),
    getCryptoPrices(),
    getAllFundPrices(),
    getLiveFxRates(),
  ]);

  const enriched = holdings.map((h) => {
    const units = h.units ?? h.qty ?? 0;
    if (!units || units <= 0) return null;

    const resolved = resolveCurrentPrice(h, stockResult, cryptoResult, fundPrices, geckoMap);
    if (!resolved) return null;

    const marketValue    = units * resolved.price;
    const marketValueEur = toEur(marketValue, resolved.currency, rates);
    if (!marketValueEur || marketValueEur <= 0) return null;

    const costBasis    = units * Number(h.avgCost ?? 0);
    const costBasisEur = toEur(costBasis, h.currency, rates);
    const plAbsEur      = marketValueEur - costBasisEur;
    const plPct         = costBasisEur > 0 ? (plAbsEur / costBasisEur) * 100 : null;

    const meta = resolveTickerMeta(h);
    return {
      ...h, units, marketValueEur, costBasisEur, plAbsEur, plPct,
      purchaseDate: h.purchaseDate ?? null,
      ...meta,
    };
  }).filter(Boolean);

  if (!enriched.length) return null;
  const totalEur = enriched.reduce((s, h) => s + h.marketValueEur, 0);

  // 1. Asset allocation
  const allocationMap = {};
  for (const h of enriched) {
    const label = h.assetClass === 'etf'    ? 'ETF'
      : h.assetClass === 'fund'   ? 'Fund'
      : h.assetClass === 'crypto' ? 'Crypto'
      : h.assetClass === 'bond'   ? 'Bond'
      : 'Stock';
    allocationMap[label] = (allocationMap[label] ?? 0) + h.marketValueEur;
  }

  // 2. Geographic exposure
  const geoMap = {};
  for (const h of enriched) {
    geoMap[h.region] = (geoMap[h.region] ?? 0) + h.marketValueEur;
  }

  // 3. Sector concentration
  const sectorMap = {};
  for (const h of enriched) {
    sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.marketValueEur;
  }

  // 4. Performance since purchase — real, from cost basis vs current value (no historical price data needed)
  const totalCostBasisEur     = enriched.reduce((s, h) => s + h.costBasisEur, 0);
  const totalPlAbsEur         = enriched.reduce((s, h) => s + h.plAbsEur, 0);
  const totalPlPct            = totalCostBasisEur > 0 ? (totalPlAbsEur / totalCostBasisEur) * 100 : null;
  const holdingsWithCostBasis = enriched.filter(h => h.costBasisEur > 0).length;

  return {
    totalEur: +totalEur.toFixed(2),
    allocation: toBreakdownGroups(allocationMap, totalEur),
    geography:  toBreakdownGroups(geoMap, totalEur),
    sectors:    toBreakdownGroups(sectorMap, totalEur),
    performance: {
      totalCostBasisEur: +totalCostBasisEur.toFixed(2),
      totalPlAbsEur:      +totalPlAbsEur.toFixed(2),
      totalPlPct:         totalPlPct != null ? +totalPlPct.toFixed(2) : null,
      holdingsWithCostBasis,
      holdingsTotal: enriched.length,
    },
    holdings: enriched.map(h => ({
      ticker:         h.ticker,
      name:           h.name,
      assetClass:     h.assetClass,
      region:         h.region,
      sector:         h.sector,
      marketValueEur: h.marketValueEur,
      costBasisEur:   +h.costBasisEur.toFixed(2),
      plAbsEur:       +h.plAbsEur.toFixed(2),
      plPct:          h.plPct != null ? +h.plPct.toFixed(2) : null,
      purchaseDate:   h.purchaseDate,
    })),
    generatedAt: new Date().toISOString(),
  };
}
