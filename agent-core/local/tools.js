// agent-core/local/tools.js
import { getCryptoPrices, getCryptoIdMap } from '../../backend/services/coingecko-service.js';
import { getStockPrices, getTechnicalData, getHeldTickers } from '../../backend/services/alphavantage-service.js';

// ── Stock price ───────────────────────────────────────────────────────────────

export async function getStockPrice(symbol) {
  const ticker = symbol.toUpperCase();
  const { prices, dataSource, warning } = await getStockPrices();
  const data = prices[ticker];

  if (!data) {
    return `Unknown stock symbol: ${ticker}. Available: ${getHeldTickers().join(', ')}`;
  }

  let priceStr;
  if (data.currency === 'USD') {
    const usd = data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const eur = data.eur.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    priceStr = `$${usd} USD (€${eur} EUR)`;
  } else if (data.currency === 'EUR') {
    priceStr = `€${data.price.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
  } else {
    priceStr = `${data.price.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${data.currency}`;
  }

  const change = data.changePct != null
    ? `${data.changePct >= 0 ? '+' : ''}${data.changePct.toFixed(2)}%`
    : 'n/a';
  const src = data.dataSource !== 'live' ? ` [${data.dataSource}]` : '';
  const warn = warning ? ` — ${warning}` : '';

  return `${ticker}: ${priceStr} (${change} 24h)${src}${warn}`;
}

// ── Technical indicators ──────────────────────────────────────────────────────

export async function getTechnicalIndicators(symbol) {
  const ticker = symbol.toUpperCase();
  const data = await getTechnicalData(ticker);

  if (data.error) return `Technical indicators for ${ticker}: ${data.error}`;

  const src = data.dataSource !== 'live' ? ` [${data.dataSource}]` : '';
  const rsiSignal = data.rsi == null ? 'n/a'
    : data.rsi > 70 ? 'overbought'
    : data.rsi < 30 ? 'oversold'
    : 'neutral';
  const trendSignal = data.sma50 == null || data.sma200 == null ? 'n/a'
    : data.sma50 > data.sma200 ? 'above 200-day MA (bullish trend)'
    : 'below 200-day MA (bearish trend)';
  const bbandsLine = data.bbands == null
    ? '  Bollinger Bands(20): n/a'
    : `  Bollinger Bands(20): upper $${data.bbands.upper?.toFixed(2)} | mid $${data.bbands.middle?.toFixed(2)} | lower $${data.bbands.lower?.toFixed(2)}`;

  return [
    `${ticker} Technical Indicators${src}:`,
    `  RSI(14): ${data.rsi?.toFixed(1) ?? 'n/a'} — ${rsiSignal}`,
    bbandsLine,
    `  SMA(50): ${data.sma50?.toFixed(2) ?? 'n/a'} | SMA(200): ${data.sma200?.toFixed(2) ?? 'n/a'} — 50-day ${trendSignal}`,
  ].join('\n');
}

// ── Market news ───────────────────────────────────────────────────────────────

import { getNewsFeed } from '../../backend/services/news-service.js';

export async function getMarketNews(ticker) {
  const { articles, total } = getNewsFeed({ ticker });
  if (!articles.length) return 'No recent market news available.';

  const top = articles.slice(0, 5);
  const lines = top.map(a => {
    const age = formatAge(a.publishedAt);
    const tags = a.tickers?.length ? ` [${a.tickers.join(', ')}]` : '';
    return `• ${a.headline} — ${a.source}, ${age}${tags}`;
  });

  const header = ticker && ticker !== 'all'
    ? `Latest news for ${ticker} (${total} article${total !== 1 ? 's' : ''}):`
    : `Market headlines (${total} article${total !== 1 ? 's' : ''} total):`;

  return [header, ...lines].join('\n');
}

function formatAge(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

// ── Crypto price ──────────────────────────────────────────────────────────────

export async function getCryptoPrice(symbol) {
  const ticker = symbol.toUpperCase();
  const geckoId = getCryptoIdMap()[ticker];
  if (!geckoId) return `Unknown crypto symbol: ${ticker}`;

  const { prices, dataSource, warning } = await getCryptoPrices();
  const data = prices[geckoId];
  if (!data) return `No price data available for ${ticker}`;

  const price = data.eur.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const change = data.eur_24h_change != null
    ? `${data.eur_24h_change >= 0 ? '+' : ''}${data.eur_24h_change.toFixed(2)}%`
    : 'n/a';
  const src = dataSource !== 'live' ? ` [${dataSource}]` : '';
  const warn = warning ? ` — ${warning}` : '';

  return `${ticker}: €${price} EUR (${change} 24h)${src}${warn}`;
}
