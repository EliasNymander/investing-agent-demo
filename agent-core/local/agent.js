// agent-core/local/agent.js
import { generateWithPhi } from "./ollamaClient.js";
import { getStockPrice, getMarketNews, getCryptoPrice, getTechnicalIndicators } from "./tools.js";
import { shouldUseClaude } from "./router.js";
import { callClaude } from "../cloud/claudeClient.js";
import { getAllHoldings } from "../../backend/config/holdings.js";
import { getStockPrices } from "../../backend/services/alphavantage-service.js";
import { getCryptoPrices, getCryptoIdMap } from "../../backend/services/coingecko-service.js";
import { getSignals } from "../../backend/services/signal-service.js";
import { getCachedArticles } from "../../backend/services/news-service.js";
import { getTaxData } from "../../backend/services/tax-service.js";

// Crypto keyword → canonical ticker (used for fast-path price lookups only)
const CRYPTO_KEYWORDS = {
  bitcoin: 'BTC', btc: 'BTC',
  ethereum: 'ETH', eth: 'ETH',
  solana: 'SOL', sol: 'SOL',
  chainlink: 'LINK', link: 'LINK',
};

// Keywords that trigger getTechnicalIndicators instead of getStockPrice
const INDICATOR_KEYWORDS = ['rsi', 'macd', 'moving average', 'sma', 'technical', 'indicator', 'overbought', 'oversold'];

// Build ticker map from live holdings at call time — never stale
function buildStockTickerMap(holdings) {
  const map = {};
  for (const h of holdings) {
    if (h.assetClass === 'crypto') continue;
    map[h.ticker.toLowerCase()] = h.ticker;
    if (h.name) {
      // first word of name as alias: "Novo Nordisk B" → "novo"
      map[h.name.split(' ')[0].toLowerCase()] = h.ticker;
    }
  }
  return map;
}

// Assemble portfolio context from cached backend services (no new API calls if caches are warm)
async function gatherAgentContext() {
  const holdings = getAllHoldings();
  const geckoMap = getCryptoIdMap(); // { ticker → geckoId }

  const [stockResult, cryptoResult, signals] = await Promise.all([
    getStockPrices(),
    getCryptoPrices(),
    getSignals(),
  ]);
  const news       = getCachedArticles();
  const taxSummary = getTaxData(new Date().getFullYear());

  const portfolio = {};
  for (const h of holdings) {
    const units = h.units ?? h.qty ?? 0;
    if (!units || units <= 0) continue;
    if (h.assetClass === 'crypto') {
      const gid  = geckoMap[h.ticker];
      const data = gid ? cryptoResult.prices?.[gid] : null;
      if (data?.eur) {
        portfolio[h.ticker] = {
          price:  data.eur,
          change: data.eur_24h_change ?? null,
          value:  +(units * data.eur).toFixed(2),
        };
      }
    } else {
      const data = stockResult.prices?.[h.ticker];
      if (data?.price) {
        portfolio[h.ticker] = {
          price:  data.eur ?? data.price,
          change: data.changePct ?? null,
          value:  +(units * (data.eur ?? data.price)).toFixed(2),
        };
      }
    }
  }

  const pricesAgeMin = stockResult.cacheAgeMin ?? cryptoResult.cacheAgeMin ?? null;
  return { portfolio, signals, news, taxSummary, pricesAgeMin };
}

export async function runLocalAgent(userQuery) {
  const q        = userQuery.toLowerCase();
  const holdings = getAllHoldings();

  // Step 1: Escalation check — keyword-based, no LLM needed
  if (shouldUseClaude(userQuery)) {
    const contextObj = await gatherAgentContext();
    return await callClaude(userQuery, contextObj);
  }

  // Step 2: Fast-path tool calls — skip Phi-3.5 planning entirely
  const STOCK_TICKERS   = buildStockTickerMap(holdings);
  const matchedCrypto   = Object.keys(CRYPTO_KEYWORDS).find(k => q.includes(k));
  const matchedStock    = Object.keys(STOCK_TICKERS).find(k => q.includes(k));
  const wantsTechnicals = INDICATOR_KEYWORDS.some(k => q.includes(k));

  // Technical indicators — only on explicit request (4 API calls, expensive)
  if (wantsTechnicals && matchedStock) {
    const symbol = STOCK_TICKERS[matchedStock];
    const result = await getTechnicalIndicators(symbol);
    return { type: "local", result };
  }

  if (q.includes("price") || matchedCrypto || matchedStock) {
    if (matchedCrypto) {
      const price = await getCryptoPrice(CRYPTO_KEYWORDS[matchedCrypto]);
      return { type: "local", result: price };
    }
    if (matchedStock) {
      const price = await getStockPrice(STOCK_TICKERS[matchedStock]);
      return { type: "local", result: price };
    }
    // Price keyword present but no recognized symbol
    return { type: "local", result: "Please specify a ticker symbol (e.g., ASML, NOVO-B, BTC)." };
  }

  if (q.includes("news")) {
    const news = await getMarketNews();
    return { type: "local", result: news };
  }

  // Step 3: Complex query — use Phi-3.5 for planning then response
  const plan = await generateWithPhi(
    `You are a local investing agent. Break this task into steps:\n\n${userQuery}`
  );
  console.log("Plan:", plan);

  const answer = await generateWithPhi(userQuery);
  return { type: "local", result: answer };
}
