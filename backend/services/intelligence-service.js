import { mockWeeklyDigest } from '../data/mock-intelligence-feed.js';
import { getCryptoPrices, getCryptoIdMap } from './coingecko-service.js';
import { getCachedArticles } from './news-service.js';
import { getAllHoldings, getTrackedAssets } from '../config/holdings.js';
import { getWatchlistTickers } from './watchlist-service.js';

// Sentiment stats for articles published in the last 48 hours
function computeSentimentStats(articles) {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = articles.filter(a => new Date(a.publishedAt).getTime() > cutoff);

  const total   = recent.length;
  const bullish = recent.filter(a => a.sentiment === 'bullish').length;
  const bearish = recent.filter(a => a.sentiment === 'bearish').length;
  const neutral = recent.filter(a => a.sentiment === 'neutral').length;

  return {
    total,
    bullishPct:   total > 0 ? Math.round((bullish / total) * 100) : 0,
    bearishPct:   total > 0 ? Math.round((bearish / total) * 100) : 0,
    neutralPct:   total > 0 ? Math.round((neutral / total) * 100) : 0,
    bullishCount: bullish,
    bearishCount: bearish,
    neutralCount: neutral,
  };
}

export async function getIntelligenceFeed() {
  const geckoToTicker = Object.fromEntries(
    Object.entries(getCryptoIdMap()).map(([ticker, id]) => [id, ticker])
  );

  const cryptoResult = await getCryptoPrices();

  const cryptoPrices = {};
  for (const [geckoId, data] of Object.entries(cryptoResult.prices)) {
    const ticker = geckoToTicker[geckoId];
    if (ticker) cryptoPrices[ticker] = data.eur;
  }

  // Live articles from news-service (synchronous — returns cached or mock)
  const articles = getCachedArticles();
  const watchlistTickers = getWatchlistTickers();
  const trackedAssets    = getTrackedAssets();
  const holdingNames     = Object.fromEntries(getAllHoldings().map(h => [h.ticker, h.name ?? h.ticker]));

  return {
    articles,
    sentimentStats: computeSentimentStats(articles),
    weeklyDigest: mockWeeklyDigest, // agent-generated in Step D/G
    cryptoPrices,
    cryptoMeta: {
      dataSource:  cryptoResult.dataSource,
      cacheAgeMin: cryptoResult.cacheAgeMin,
      warning:     cryptoResult.warning,
    },
    watchlistTickers,
    trackedAssets,
    holdingNames,
  };
}
