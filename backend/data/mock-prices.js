// EUR/USD: 1.085 | EUR/SEK: 11.42 | EUR/DKK: 7.46
// Some prices intentionally cross alert thresholds for demo purposes:
//   NOVO-B -4.00% → crosses ±3% stock threshold
//   BTC +3.00% → notable crypto daily move

export const mockPrices = {
  IWDA: {
    price: 118.90,
    prevClose: 118.43,
    dailyPct: 0.40,
    currency: 'EUR',
    updatedAt: '2026-05-12T15:45:00Z',
  },
  'NOVO-B': {
    price: 545.00,
    prevClose: 567.71,
    dailyPct: -4.00,
    currency: 'DKK',
    updatedAt: '2026-05-12T17:30:00Z',
  },
  ASML: {
    price: 940.00,
    prevClose: 934.39,
    dailyPct: 0.60,
    currency: 'EUR',
    updatedAt: '2026-05-12T17:30:00Z',
  },
  VWCE: {
    price: 128.50,
    prevClose: 127.86,
    dailyPct: 0.50,
    currency: 'EUR',
    updatedAt: '2026-05-12T17:30:00Z',
  },
  'VOLV-B': {
    price: 279.00,
    prevClose: 277.06,
    dailyPct: 0.70,
    currency: 'SEK',
    updatedAt: '2026-05-12T17:30:00Z',
  },
  SHEL: {
    price: 29.10,
    prevClose: 29.00,
    dailyPct: 0.34,
    currency: 'EUR',
    updatedAt: '2026-05-12T17:30:00Z',
  },
  'NORDEA-STABLE': {
    price: 19.45,
    prevClose: 19.36,
    dailyPct: 0.46,
    currency: 'EUR',
    updatedAt: '2026-05-09T18:00:00Z',
    isNav: true,
  },
  'NORDEA-NORDIC-SC': {
    price: 44.80,
    prevClose: 44.55,
    dailyPct: 0.56,
    currency: 'EUR',
    updatedAt: '2026-05-09T18:00:00Z',
    isNav: true,
  },
  BTC: {
    price: 58200,
    prevClose: 56504.85,
    dailyPct: 3.00,
    currency: 'EUR',
    updatedAt: '2026-05-12T16:00:00Z',
    dataSource: 'CoinGecko (mock)',
  },
  ADA: {
    price: 0.39,
    prevClose: 0.3924,
    dailyPct: -0.61,
    currency: 'EUR',
    updatedAt: '2026-05-12T16:00:00Z',
    dataSource: 'CoinGecko (mock)',
  },
  DOT: {
    price: 6.35,
    prevClose: 6.30,
    dailyPct: 0.79,
    currency: 'EUR',
    updatedAt: '2026-05-12T16:00:00Z',
    dataSource: 'CoinGecko (mock)',
  },
};

export const fxRates = {
  EUR_USD: 1.085,
  EUR_SEK: 11.42,
  EUR_NOK: 11.78,
  EUR_GBP: 0.845,
  EUR_DKK: 7.46,
  USD_EUR: 1 / 1.085,
  SEK_EUR: 1 / 11.42,
  NOK_EUR: 1 / 11.78,
  GBP_EUR: 1 / 0.845,
  DKK_EUR: 1 / 7.46,
};
