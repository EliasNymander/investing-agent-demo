/**
 * context-compressor-service.js
 *
 * Deterministic context compression for Claude API calls.
 * No LLM involved — all rules are explicit and produce consistent output.
 *
 * Rules:
 *  - Portfolio, signals, tax, technical indicators: always verbatim
 *  - News: programmatic top-N filter (HIGH impact first, then most recent,
 *    then MEDIUM; LOW dropped if over budget; hard cap of MAX_NEWS_ARTICLES)
 */

import { getAllHoldings } from '../config/holdings.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_NEWS_ARTICLES = 5;

// Rough token estimate: 1 token ≈ 4 chars
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// ── Impact classification ─────────────────────────────────────────────────────

function resolveImpact(article) {
  // Use existing field if present (set by news-service.js assignImpact)
  if (article.impactRating === 'HIGH')   return 'HIGH';
  if (article.impactRating === 'MEDIUM') return 'MEDIUM';
  if (article.impactRating === 'LOW')    return 'LOW';
  // Fallback: compute from tickers — read fresh holdings per call, not a stale module snapshot
  const portfolioTickers = getAllHoldings().map(h => h.ticker);
  const tickers = article.tickers ?? [];
  if (tickers.some(t => portfolioTickers.includes(t))) return 'HIGH';
  return 'LOW';
}

// ── News pre-filter ───────────────────────────────────────────────────────────

function filterNews(articles) {
  if (!articles?.length) return [];

  const ts = a => (a.publishedAt ? new Date(a.publishedAt).getTime() : 0);

  const high = articles
    .filter(a => resolveImpact(a) === 'HIGH')
    .sort((a, b) => ts(b) - ts(a));

  const medium = articles
    .filter(a => resolveImpact(a) === 'MEDIUM')
    .sort((a, b) => ts(b) - ts(a));

  // HIGH first, then MEDIUM to fill remaining slots; LOW dropped entirely
  return [...high, ...medium].slice(0, MAX_NEWS_ARTICLES);
}

// ── Section serializers ───────────────────────────────────────────────────────

function serializePortfolio(portfolio) {
  if (!portfolio || !Object.keys(portfolio).length) return '';
  const lines = ['PORTFOLIO:'];
  for (const [ticker, data] of Object.entries(portfolio)) {
    const price  = data.price  != null ? `$${data.price}`  : 'n/a';
    const change = data.change != null ? `${data.change > 0 ? '+' : ''}${data.change}%` : '';
    const value  = data.value  != null ? ` (€${data.value})` : '';
    lines.push(`  ${ticker}: ${price} ${change}${value}`.trimEnd());
  }
  return lines.join('\n');
}

function serializeNews(articles) {
  if (!articles?.length) return '';
  const lines = ['NEWS:'];
  for (const a of articles) {
    const impact    = resolveImpact(a);
    const tickers   = a.tickers?.length ? ` [${a.tickers.join(',')}]` : '';
    const sentiment = a.sentiment ? ` (${a.sentiment})` : '';
    lines.push(`  [${impact}] ${a.headline}${tickers}${sentiment}`);
    if (a.summary) lines.push(`    ${a.summary}`);
  }
  return lines.join('\n');
}

function serializeSignals(signals) {
  if (!signals?.length) return '';
  const lines = ['SIGNALS:'];
  for (const s of signals) {
    lines.push(`  ${s.action?.toUpperCase() ?? 'WATCH'} ${s.ticker ?? ''}: ${s.reasoning ?? s.reason ?? ''}`.trimEnd());
  }
  return lines.join('\n');
}

function serializeTaxSummary(tax) {
  if (!tax) return '';
  const lines = ['TAX SUMMARY:'];
  if (tax.realizedGains   != null) lines.push(`  Realized gains:  €${tax.realizedGains}`);
  if (tax.realizedLosses  != null) lines.push(`  Realized losses: €${tax.realizedLosses}`);
  if (tax.carryForward    != null) lines.push(`  Carry-forward:   €${tax.carryForward}`);
  if (tax.taxLiability    != null) lines.push(`  Tax liability:   €${tax.taxLiability}`);
  return lines.join('\n');
}

function serializeTechnicals(technicals) {
  if (!technicals || !Object.keys(technicals).length) return '';
  const lines = ['TECHNICALS:'];
  for (const [ticker, data] of Object.entries(technicals)) {
    const parts = [];
    if (data.rsi   != null) parts.push(`RSI ${data.rsi}`);
    if (data.sma50 != null) parts.push(`SMA50 ${data.sma50}`);
    if (data.sma200 != null) parts.push(`SMA200 ${data.sma200}`);
    if (data.bbands) parts.push(`BBands(${data.bbands})`);
    if (parts.length) lines.push(`  ${ticker}: ${parts.join(', ')}`);
  }
  return lines.join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compresses context deterministically before sending to Claude API.
 *
 * Verbatim sections (never modified): portfolio, signals, tax, technicals, extra.
 * News articles: filtered to top MAX_NEWS_ARTICLES by impact then recency.
 *
 * @param {object} ctx
 *   portfolio   — { [ticker]: { price, change, value } }
 *   news        — array of normalized article objects from news-service.js
 *   signals     — array of signal objects { action, ticker, reasoning }
 *   taxSummary  — { realizedGains, realizedLosses, carryForward, taxLiability }
 *   technicals  — { [ticker]: { rsi, sma50, sma200, bbands } }
 *   extra       — any additional string context (always verbatim)
 *
 * @returns {{
 *   text: string,
 *   wasFiltered: boolean,
 *   originalArticleCount: number,
 *   keptArticleCount: number,
 *   droppedArticleCount: number,
 *   originalTokenEstimate: number,
 *   compressedTokenEstimate: number,
 * }}
 */
export function compressContext({
  portfolio,
  news,
  signals,
  taxSummary,
  technicals,
  extra,
} = {}) {
  const originalCount = news?.length ?? 0;
  const filtered      = filterNews(news ?? []);
  const keptCount     = filtered.length;

  const parts = [
    serializePortfolio(portfolio),
    serializeNews(filtered),
    serializeSignals(signals),
    serializeTaxSummary(taxSummary),
    serializeTechnicals(technicals),
    extra ?? '',
  ]
    .map(s => s.trim())
    .filter(Boolean);

  const text                 = parts.join('\n\n');
  const originalTokens       = estimateTokens(
    // estimate what the unfiltered version would have been
    [
      serializePortfolio(portfolio),
      serializeNews(news ?? []),
      serializeSignals(signals),
      serializeTaxSummary(taxSummary),
      serializeTechnicals(technicals),
      extra ?? '',
    ].map(s => s.trim()).filter(Boolean).join('\n\n')
  );
  const compressedTokens     = estimateTokens(text);
  const wasFiltered          = originalCount > keptCount;

  if (wasFiltered) {
    const reductionPct = Math.round((1 - compressedTokens / originalTokens) * 100);
    console.log(
      `[context-compressor] News filtered: ${originalCount} → ${keptCount} articles | ` +
      `Tokens: ${originalTokens} → ${compressedTokens} (${reductionPct}% reduction)`
    );
  }

  return {
    text,
    wasFiltered,
    originalArticleCount:    originalCount,
    keptArticleCount:        keptCount,
    droppedArticleCount:     originalCount - keptCount,
    originalTokenEstimate:   originalTokens,
    compressedTokenEstimate: compressedTokens,
  };
}
