// agent-core/cloud/claudeClient.js
//
// Claude API escalation client for the investing agent.
// Handles: budget enforcement, prompt caching, context compression,
// response parsing, dataPoints integrity, and full fallback chain.

import Anthropic from '@anthropic-ai/sdk';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

import {
  checkBudget,
  recordUsage,
  calculateCost,
  LIMITS,
} from '../../backend/services/claude-budget-service.js';
import { compressContext } from '../../backend/services/context-compressor-service.js';
import { generateWithPhi } from '../local/ollamaClient.js';
import { getAllHoldings } from '../../backend/config/holdings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

const USE_MOCK = process.env.USE_CLAUDE_MOCK !== 'false';
const MODEL    = 'claude-sonnet-4-6';

// ── Static cached blocks ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a personal investing agent for a Finnish retail investor.
You have access to live prices, recent news, active signals, and
portfolio data for their specific holdings. The exact holdings are
listed in the HOLDINGS section of the context provided with each query.

INVESTING STYLE:
  Mixed strategies — some positions held long-term (years), others
  actively traded (weeks/months). Distinguish in recommendations
  which time horizon you are addressing.

REASONING RULES:
1. Anchor every claim to the data provided — never fabricate prices,
   percentages, or dates. If data is missing or stale, say so explicitly.
2. Distinguish clearly:
     FACT     — a value from the provided context
     ANALYSIS — your reasoning applied to that value
     OPINION  — a qualitative judgment with acknowledged uncertainty
3. Lead with the single most actionable insight, not background context.
4. Be numerically specific: "ASML +0.60% to €940.00" not "ASML is up".
5. When signals conflict, state the conflict; do not hide uncertainty.
6. Never recommend a position size or total allocation — you see partial
   portfolio data and cannot assess the user's full financial picture.
7. You are not a regulated financial advisor. Frame recommendations as
   analysis to consider, not directives. Final decisions are always
   the user's responsibility.

RESPONSE FORMAT — always return valid JSON:
{
  "type": "claude_response",
  "summary": "<one sentence — the single most important insight>",
  "analysis": "<3-5 sentences of reasoning, grounded in the data>",
  "dataPoints": [{ "label": "<metric name>", "value": "<exact value from context>" }],
  "recommendation": "<specific action, or null if no clear action>",
  "confidence": "high" | "medium" | "low"
}

confidence:
  high   — fresh data (<15 min), strong signal, no conflicting indicators
  medium — stale data (>1h), mixed signals, or partial data
  low    — missing price data, highly uncertain macro, or conflicting signals

dataPoints must reference values from context only — no invented numbers.

Return the JSON object directly — no markdown formatting, no code fences, no backticks.`;

const TAX_PRINCIPLES = `FINNISH CAPITAL GAINS TAX (2024–2025):
  30% on annual gains up to €30,000
  34% on annual gains above €30,000
  Same-year losses offset gains before the bracket applies
  Net capital losses carry forward 5 years (Tuloverolaki §50)
  Crypto is capital gains in Finland, not income
  FX gain on EUR conversion at disposal is taxable
  No wash-sale rule — loss harvesting with same-security repurchase
    is permitted under Finnish tax law
  Cost basis method: FIFO unless stated otherwise

FX CONSIDERATION:
  VOLV-B trades in SEK. Realized gains convert at disposal-date
  EUR/SEK rate. Track SEK→EUR conversion for cost basis.

SIGNAL LOGIC:
  BUY   — price below 200-day SMA or key support AND thesis intact AND RSI < 65
  SELL  — thesis broken, OR debt risk unacceptable, OR stop-loss reached
  WATCH — thesis intact but entry price not reached, or awaiting catalyst

OUTPUT CONTRACT:
  Respond with valid JSON only — no prose outside the JSON object.
  The "analysis" field may be up to 5 sentences.
  The "dataPoints" array must be empty rather than contain invented values.`;

// ── Context builder ───────────────────────────────────────────────────────────

function computeTotals(portfolio) {
  let totalValue = 0, totalDailyPnl = 0;
  for (const data of Object.values(portfolio ?? {})) {
    const v = data.value  ?? 0;
    const c = data.change ?? 0;
    totalValue    += v;
    totalDailyPnl += v * c / (100 + c);
  }
  const pnlPct = totalValue > 0
    ? (totalDailyPnl / (totalValue - totalDailyPnl)) * 100
    : 0;
  return { totalValue, dailyPnl: totalDailyPnl, pnlPct };
}

function buildHoldingsHeader() {
  const holdings = getAllHoldings();
  const stocks  = holdings.filter(h => h.assetClass !== 'crypto' && h.assetClass !== 'bond');
  const bonds   = holdings.filter(h => h.assetClass === 'bond');
  const crypto  = holdings.filter(h => h.assetClass === 'crypto');
  const lines   = ['HOLDINGS:'];
  if (stocks.length)  lines.push(`  Stocks/ETFs: ${stocks.map(h => `${h.ticker}${h.name ? ` (${h.name})` : ''}`).join(', ')}`);
  if (bonds.length)   lines.push(`  Bonds/Fixed: ${bonds.map(h => `${h.ticker}${h.name ? ` (${h.name})` : ''}`).join(', ')}`);
  if (crypto.length)  lines.push(`  Crypto:      ${crypto.map(h => h.ticker).join(', ')}`);
  return lines.join('\n');
}

function buildPortfolioContext(portfolio, signals, news, taxSummary, technicals, pricesAgeMin) {
  const { totalValue, dailyPnl, pnlPct } = computeTotals(portfolio);
  const compressed = compressContext({ portfolio, news, signals, taxSummary, technicals });
  const date    = new Date().toISOString().split('T')[0];
  const ageStr  = pricesAgeMin != null ? `prices ${pricesAgeMin} min ago` : 'price age unknown';
  const pnlSign = dailyPnl >= 0 ? '+' : '';
  const totals  =
    `  Total: €${Math.round(totalValue).toLocaleString()}  ` +
    `Today: ${pnlSign}€${Math.round(dailyPnl)} (${pnlSign}${pnlPct.toFixed(2)}%)`;
  const withTotals = compressed.text.replace(/^(PORTFOLIO:)/m, `$1  [${date}, ${ageStr}]\n${totals}`);
  return `${buildHoldingsHeader()}\n\n${withTotals}`;
}

// ── DataPoints integrity ──────────────────────────────────────────────────────

function checkDataPointsIntegrity(dataPoints, contextText) {
  if (!dataPoints?.length) return;
  for (const dp of dataPoints) {
    if (!dp.value) continue;
    if (!contextText.includes(dp.value)) {
      console.warn(
        `[claudeClient] dataPoint hallucination warning: "${dp.label}" = "${dp.value}" not found in context`
      );
    }
  }
}

// ── Deep Analysis Package (paste into claude.ai when budget is blocked) ───────

function buildDeepAnalysisPackage(userQuery, contextObj) {
  const { portfolio, signals, news, taxSummary, technicals, pricesAgeMin } = contextObj;
  const ctx  = buildPortfolioContext(portfolio, signals, news, taxSummary, technicals, pricesAgeMin);
  const date = new Date().toISOString().split('T')[0];
  return [
    `# Deep Analysis Request — ${date}`,
    '',
    '## Your Question',
    userQuery,
    '',
    '## Portfolio Context',
    ctx,
    '',
    '---',
    'Paste this entire block into claude.ai for a full analysis without API cost.',
  ].join('\n');
}

// ── Fallback helpers ──────────────────────────────────────────────────────────

let lastCachedResponse = null;

const HARDCODED_MOCK = {
  type: 'offline_fallback',
  summary: 'Agent is temporarily offline — all fallback paths exhausted.',
  analysis:
    'Claude API is unavailable, Phi-3.5 is not responding, and no cached response exists. ' +
    'Check Ollama status and ANTHROPIC_API_KEY configuration.',
  dataPoints: [],
  recommendation: null,
  confidence: 'low',
  meta: { model: null, fallback: true, allPathsExhausted: true },
};

function cachedOrMockFallback() {
  if (lastCachedResponse) {
    console.log('[claudeClient] Returning last cached response');
    return { ...lastCachedResponse, meta: { ...lastCachedResponse.meta, fromCache: true } };
  }
  console.log('[claudeClient] No cache available — returning hardcoded fallback');
  return HARDCODED_MOCK;
}

async function phiFallback(userQuery) {
  console.log('[claudeClient] Falling back to Phi-3.5...');
  try {
    const phiText = await generateWithPhi(
      `You are an investing assistant. Answer this query concisely:\n\n${userQuery}`
    );
    const result = {
      type: 'phi_fallback',
      summary: phiText.slice(0, 200),
      analysis: phiText,
      dataPoints: [],
      recommendation: null,
      confidence: 'low',
      meta: { model: 'phi3.5', fallback: true },
    };
    lastCachedResponse = result;
    return result;
  } catch (err) {
    console.error(`[claudeClient] Phi-3.5 fallback failed: ${err.message}`);
    return cachedOrMockFallback();
  }
}

// ── Mock response ─────────────────────────────────────────────────────────────

function buildMockResponse(userQuery) {
  return {
    type: 'claude_response',
    summary: '[MOCK] Simulated Claude response — no API call was made.',
    analysis:
      `Mock mode is active (USE_CLAUDE_MOCK !== "false"). ` +
      `Query received: "${userQuery.slice(0, 100)}". ` +
      `Set USE_CLAUDE_MOCK=false and provide ANTHROPIC_API_KEY to enable real responses.`,
    dataPoints: [],
    recommendation: null,
    confidence: 'low',
    meta: { model: MODEL, mock: true },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Main entry point for Claude API escalation.
 *
 * @param {string} userQuery
 * @param {object} contextObj
 *   portfolio    — { [ticker]: { price, change, value } }
 *   signals      — array of signal objects
 *   news         — array of normalized article objects
 *   taxSummary   — { realizedGains, realizedLosses, carryForward, taxLiability }
 *   technicals   — { [ticker]: { rsi, sma50, sma200, bbands } }
 *   pricesAgeMin — number (minutes since last price fetch), or null
 *
 * @returns {object} Structured response — type indicates the path taken:
 *   'claude_response'   — real API call succeeded
 *   'budget_blocked'    — blocked before calling; includes deepAnalysisPackage
 *   'phi_fallback'      — Claude failed, Phi-3.5 answered
 *   'offline_fallback'  — all paths exhausted
 */
export async function callClaude(userQuery, contextObj = {}) {
  const { portfolio, signals, news, taxSummary, technicals, pricesAgeMin } = contextObj;

  // ── Step 1: Budget check ────────────────────────────────────────────────────
  const budget = checkBudget();
  if (!budget.allowed) {
    console.log(`[claudeClient] Blocked by budget: ${budget.reason} — ${budget.message}`);
    return {
      type: 'budget_blocked',
      reason: budget.reason,
      message: budget.message,
      deepAnalysisPackage: buildDeepAnalysisPackage(userQuery, contextObj),
    };
  }
  if (budget.softWarning) {
    console.warn(`[claudeClient] Budget soft warning: ${budget.softWarningMessage}`);
  }

  // ── Step 2: Build dynamic context block (not cached) ───────────────────────
  const portfolioContext = buildPortfolioContext(
    portfolio, signals, news, taxSummary, technicals, pricesAgeMin
  );

  // ── Mock mode ───────────────────────────────────────────────────────────────
  if (USE_MOCK) {
    console.log('[claudeClient] USE_MOCK=true — returning mock response (no API call made)');
    const mock = buildMockResponse(userQuery);
    lastCachedResponse = mock;
    return mock;
  }

  // ── Step 3: API key check ───────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[claudeClient] ANTHROPIC_API_KEY not set — falling back to Phi-3.5');
    return await phiFallback(userQuery);
  }

  // ── Step 3: Claude API call ────────────────────────────────────────────────
  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.messages.create({
      model:      MODEL,
      max_tokens: LIMITS.maxOutputTokens,
      system: [
        { type: 'text', text: SYSTEM_PROMPT,      cache_control: { type: 'ephemeral' } },
        { type: 'text', text: TAX_PRINCIPLES,     cache_control: { type: 'ephemeral' } },
        { type: 'text', text: portfolioContext  /* no cache_control — dynamic */ },
      ],
      messages: [{ role: 'user', content: userQuery }],
    });
  } catch (err) {
    console.error(`[claudeClient] API call failed: ${err.message} — falling back to Phi-3.5`);
    return await phiFallback(userQuery);
  }

  // ── Step 4: Record usage ───────────────────────────────────────────────────
  const cost = calculateCost(response.usage);
  recordUsage(response.usage, cost);
  console.log(
    `[claudeClient] OK — in:${response.usage.input_tokens} ` +
    `cached:${response.usage.cache_read_input_tokens ?? 0} ` +
    `out:${response.usage.output_tokens} ` +
    `cost:$${cost.toFixed(6)}`
  );

  // ── Step 4: Parse and validate response ────────────────────────────────────
  const rawText = response.content[0]?.text ?? '';

  // Strip markdown code fences if Claude wrapped the JSON anyway.
  // Handles: ```json\n{...}\n``` and bare ```\n{...}\n```
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn('[claudeClient] Response was not valid JSON — wrapping raw text');
    parsed = {
      type:           'claude_response',
      summary:        cleaned.slice(0, 200),
      analysis:       cleaned,
      dataPoints:     [],
      recommendation: null,
      confidence:     'low',
    };
  }

  checkDataPointsIntegrity(parsed.dataPoints, portfolioContext);

  const result = {
    ...parsed,
    type: 'claude_response',
    meta: {
      model:                MODEL,
      usage:                response.usage,
      cost,
      softWarning:          budget.softWarning,
      softWarningMessage:   budget.softWarningMessage ?? null,
    },
  };

  lastCachedResponse = result;
  return result;
}

/**
 * Returns the last successful response from any path (Claude or Phi-3.5).
 * Useful for the frontend to show stale data during outages.
 */
export function getLastCachedResponse() {
  return lastCachedResponse;
}

/**
 * Returns the current budget status for the UI BudgetWidget.
 * Re-exports from budget service so callers only need one import.
 */
export { getStatus as getBudgetStatus } from '../../backend/services/claude-budget-service.js';
