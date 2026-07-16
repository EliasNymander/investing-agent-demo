import { mockPrices, fxRates } from '../data/mock-prices.js';
import { getHoldings } from '../config/holdings.js';

const allPrices = mockPrices;

// Seeded PRNG for consistent data across refreshes
function seededRng(seed) {
  let s = seed;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 0xffffffff;
  };
}

function tickerSeed(ticker) {
  return ticker.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 7);
}

// Brownian bridge: random path that starts at startPrice and ends at endPrice
function brownianBridge(startPrice, endPrice, n, vol, rng) {
  const increments = Array.from({ length: n }, () => (rng() - 0.5) * 2 * vol);
  const cumsum = increments.reduce((acc, v, i) => {
    acc.push((acc[i - 1] ?? 0) + v);
    return acc;
  }, []);
  const totalCum = cumsum[n - 1];

  return Array.from({ length: n }, (_, i) => {
    const trend = startPrice + ((endPrice - startPrice) * i) / (n - 1);
    const bridge = (cumsum[i] - totalCum * (i / (n - 1))) * startPrice;
    return Math.max(trend + bridge, startPrice * 0.1);
  });
}

// Annual returns per ticker (sets the starting price 1 year ago)
const ANNUAL_RETURN = {
  IWDA: 0.14,
  'NOVO-B': 0.08,
  ASML: 0.22,
  VWCE: 0.15,
  'VOLV-B': 0.06,
  SHEL: 0.03,
  'NORDEA-STABLE': 0.05,
  'NORDEA-NORDIC-SC': 0.09,
  BTC: 0.65,
  ADA: 0.15,
  DOT: 0.30,
};

const VOLATILITY = {
  stock: 0.018,
  etf: 0.01,
  fund: 0.004,
  crypto: 0.045,
};

// Cache so data stays consistent within a session
const historyCache = {};

function generateDailyPoints(ticker, currentPrice, assetClass) {
  if (historyCache[ticker]) return historyCache[ticker];

  const rng = seededRng(tickerSeed(ticker));
  const vol = VOLATILITY[assetClass] ?? 0.018;
  const annualReturn = ANNUAL_RETURN[ticker] ?? 0.1;
  const startPrice = currentPrice / (1 + annualReturn);

  const today = new Date('2026-05-12');
  const days = [];

  // Generate 365 daily dates (skip weekends for non-crypto)
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (assetClass !== 'crypto' && (dow === 0 || dow === 6)) continue;
    days.push(d.toISOString().split('T')[0]);
  }

  const prices = brownianBridge(startPrice, currentPrice, days.length, vol, rng);
  const result = days.map((date, i) => ({ date, price: +prices[i].toFixed(4) }));

  historyCache[ticker] = result;
  return result;
}

function generateIntradayPoints(ticker, currentPrice, assetClass) {
  const key = `${ticker}_1D`;
  if (historyCache[key]) return historyCache[key];

  const rng = seededRng(tickerSeed(ticker) + 999);
  const vol = (VOLATILITY[assetClass] ?? 0.018) / 4; // hourly vol
  const prevClose = currentPrice / (1 + allPrices[ticker]?.dailyPct / 100 || 1);

  const hours = assetClass === 'crypto'
    ? ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00','now']
    : ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','now'];

  const n = hours.length;
  const prices = brownianBridge(prevClose, currentPrice, n, vol, rng);
  const result = hours.map((h, i) => ({ time: h, price: +prices[i].toFixed(4) }));

  historyCache[key] = result;
  return result;
}

function sliceByPeriod(allPoints, period) {
  const cutoffs = { '1W': 5, '1M': 22, '3M': 66, '6M': 130, '1Y': 365 };
  const n = cutoffs[period] ?? allPoints.length;
  return allPoints.slice(-n);
}

export function getTickerHistory(ticker, assetClass, period) {
  const priceData = allPrices[ticker];
  if (!priceData) return null;

  if (period === '1D') {
    return generateIntradayPoints(ticker, priceData.price, assetClass);
  }

  const daily = generateDailyPoints(ticker, priceData.price, assetClass);
  return sliceByPeriod(daily, period);
}

function toEurValue(qty, price, currency) {
  switch (currency) {
    case 'EUR': return qty * price;
    case 'USD': return qty * price * fxRates.USD_EUR;
    case 'SEK': return qty * price * fxRates.SEK_EUR;
    default: return qty * price;
  }
}

export function getPortfolioHistory(period) {
  // Aggregate all platforms. Filter to weekdays only so weekend crypto-only
  // dates don't produce partial values (stocks have no weekend data points).
  const h = getHoldings();
  const allHoldings = [...(h.nordnet ?? []), ...(h.nordea ?? []), ...(h.kvarnx ?? [])];

  const dateMap = {};
  for (const holding of allHoldings) {
    const priceData = mockPrices[holding.ticker];
    if (!priceData) continue;
    const pts = generateDailyPoints(holding.ticker, priceData.price, holding.assetClass);
    for (const { date, price } of pts) {
      const dow = new Date(date + 'T00:00:00').getDay();
      if (dow === 0 || dow === 6) continue;
      if (!dateMap[date]) dateMap[date] = 0;
      dateMap[date] += toEurValue(holding.units, price, holding.currency);
    }
  }

  const sorted = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: +value.toFixed(2) }));

  const cutoffs = { '1W': 5, '1M': 22, '3M': 66, '6M': 130, '1Y': 260 };
  const n = cutoffs[period] ?? sorted.length;
  return sorted.slice(-n);
}

export function getPlatformHistory(platformId, period) {
  const h = getHoldings();
  const holdings = h[platformId];
  if (!Array.isArray(holdings)) return null;

  // Get all daily points for each holding, find common dates
  const allSeries = holdings.map((holding) => {
    const priceData = mockPrices[holding.ticker];
    if (!priceData) return null;
    const pts = generateDailyPoints(holding.ticker, priceData.price, holding.assetClass);
    return { holding, pts };
  }).filter(Boolean);

  if (allSeries.length === 0) return [];

  // Build a date-indexed map: date → total EUR value
  const dateMap = {};
  for (const { holding, pts } of allSeries) {
    for (const { date, price } of pts) {
      if (!dateMap[date]) dateMap[date] = 0;
      dateMap[date] += toEurValue(holding.units, price, holding.currency);
    }
  }

  const sorted = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: +value.toFixed(2) }));

  const cutoffs = { '1W': 5, '1M': 22, '3M': 66, '6M': 130, '1Y': 365 };
  const n = cutoffs[period] ?? sorted.length;
  return sorted.slice(-n);
}
