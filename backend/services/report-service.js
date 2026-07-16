import { mockTechnicals } from '../data/mock-technicals.js';
import { mockOpportunities } from '../data/mock-opportunities.js';
import { mockPortfolio } from '../data/mock-portfolio.js';
import { mockPrices, fxRates } from '../data/mock-prices.js';
import { toEur } from '../utils/currency.js';
import { getCryptoPrices, getCryptoIdMap } from './coingecko-service.js';

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export async function getWeeklyReport() {
  const now = new Date();

  // Fetch live crypto prices (cache-first)
  const cryptoResult = await getCryptoPrices();

  // Build USD-equivalent price map for crypto tickers
  const liveCryptoPriceUsd = {};
  for (const [ticker, geckoId] of Object.entries(getCryptoIdMap())) {
    const live = cryptoResult.prices[geckoId];
    if (live) {
      liveCryptoPriceUsd[ticker] = +(live.eur * fxRates.EUR_USD).toFixed(2);
    }
  }

  const allHoldings = [
    ...mockPortfolio.nordnet,
    ...mockPortfolio.nordea,
    ...mockPortfolio.kvarnx,
  ];

  const performanceRows = allHoldings.map((h) => {
    // Use live price for crypto, mockPrices for everything else
    const livePrice = liveCryptoPriceUsd[h.ticker];
    const price = mockPrices[h.ticker];
    const tech = mockTechnicals[h.ticker];

    const currentPrice = livePrice ?? price?.price ?? h.avgCost;
    const weekPerf = tech?.weekPerf ?? 0;
    const weekOpen = currentPrice / (1 + weekPerf / 100);
    const marketValue = h.qty * currentPrice;
    const marketValueEur = toEur(marketValue, h.currency);
    const plPct = ((currentPrice - h.avgCost) / h.avgCost) * 100;

    return {
      ticker: h.ticker,
      name: h.name,
      platform: h.platform,
      assetClass: h.assetClass,
      currency: h.currency,
      qty: h.qty,
      weekOpen: +weekOpen.toFixed(2),
      weekClose: currentPrice,
      weekPerfPct: weekPerf,
      marketValueEur: +marketValueEur.toFixed(2),
      totalPlPct: +plPct.toFixed(2),
      benchmarkPerf: tech?.benchmarkPerf ?? null,
      vsBenchmark: tech?.vsbenchmark ?? null,
      ...(h.assetClass === 'crypto' ? { livePrice: true, dataSource: 'CoinGecko' } : {}),
    };
  });

  const totalWeekPlEur = performanceRows.reduce((sum, r) => {
    const weekGain = r.marketValueEur * (r.weekPerfPct / 100 / (1 + r.weekPerfPct / 100));
    return sum + weekGain;
  }, 0);

  const technicals = Object.entries(mockTechnicals).map(([ticker, data]) => ({
    ticker,
    ...data,
  }));

  return {
    weekNumber: getISOWeek(now),
    year: now.getFullYear(),
    performance: {
      rows: performanceRows,
      totalWeekPlEur: +totalWeekPlEur.toFixed(2),
    },
    technicals,
    opportunities: mockOpportunities,
    macroEnvironment: {
      summary: 'ECB holds at 3.25%, Riksbank delays cuts. US corporate earnings season strong. Bitcoin post-halving cycle in full swing. Nordic financials stable. Overall risk appetite: MODERATE-HIGH.',
      keyThemes: [
        'Central bank divergence (ECB hawkish, Fed on hold)',
        'AI infrastructure capex driving semiconductor earnings',
        'Post-Bitcoin-halving supply squeeze accelerating',
        'Swedish real estate sector under refinancing pressure',
        'EUR strength on ECB hold; SEK weakness on Riksbank delay',
      ],
    },
    cryptoMeta: {
      dataSource:  cryptoResult.dataSource,
      cacheAgeMin: cryptoResult.cacheAgeMin,
      warning:     cryptoResult.warning,
    },
    generatedAt: now.toISOString(),
  };
}
