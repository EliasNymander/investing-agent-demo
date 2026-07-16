// backend/services/scheduled-job-service.js
//
// Orchestrator for scheduled Claude API jobs.
// Generates daily briefings and weekly reports using live context data.
// Does NOT modify alert-service.js, report-service.js, or claude-service.js.

import Anthropic from '@anthropic-ai/sdk';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

import { checkBudget, recordUsage, calculateCost, getStatus, LIMITS }
  from './claude-budget-service.js';
import { compressContext } from './context-compressor-service.js';
import { getCryptoPrices } from './coingecko-service.js';
import { getStockPrices } from './alphavantage-service.js';
import { getSignals } from './signal-service.js';
import { getNewsFeed } from './news-service.js';
import { getTaxData } from './tax-service.js';
import { generateWithPhi } from '../../agent-core/local/ollamaClient.js';
import { getHoldings, getCryptoIds, buildHoldingsUniverse } from '../config/holdings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

const MODEL    = 'claude-sonnet-4-6';
const USE_MOCK = process.env.USE_CLAUDE_MOCK !== 'false';

// Scheduled jobs produce longer JSON than chat responses — use higher caps.
// Chat responses use LIMITS.maxOutputTokens (1000) for cost projection.
const DAILY_MAX_TOKENS  = 1500;
const WEEKLY_MAX_TOKENS = 2000;


// ── System prompts (static — eligible for prompt caching) ─────────────────────

function buildDailySystemPrompt(holdingsUniverse) {
  return `You are a personal investing agent for a Finnish retail investor.
Generate a concise daily briefing based on the provided portfolio and market context.

HOLDINGS UNIVERSE:
${holdingsUniverse}

BRIEFING RULES:
1. Lead with the single most important market development affecting the portfolio today.
2. keyInsights: 3-5 bullet-point insights — each anchored to a specific data point from context.
3. signalUpdates: for each active signal, confirm status or note any change. Use change="confirmed" when the prior signal still holds; "upgraded", "downgraded", or "new" when appropriate.
4. topNewsAnalysis: 2-3 sentences synthesizing the highest-impact news items from context.
5. Never invent prices, percentages, or dates not present in the provided context. If data is missing or stale, say so explicitly.
6. actionItems: 0-3 specific, time-sensitive actions relevant today. Omit (empty array) if nothing is urgent.
7. riskFlags: 0-2 same-day risks that could move portfolio positions materially today.

RESPONSE FORMAT — always return valid JSON:
{
  "headline": "<one sentence — the most important thing today>",
  "keyInsights": ["<insight 1>", "<insight 2>", ...],
  "signalUpdates": [
    { "ticker": "<symbol>", "action": "buy|sell|watch", "change": "confirmed|upgraded|downgraded|new", "reasoning": "<one sentence>" }
  ],
  "topNewsAnalysis": "<2-3 sentences>",
  "actionItems": ["<action 1>", ...],
  "riskFlags": ["<risk 1>", ...],
  "confidence": "high|medium|low"
}

confidence:
  high   — fresh data (<15 min), no conflicting signals
  medium — stale data (>1h) or mixed signals
  low    — missing data or high uncertainty

Return the JSON object directly — no markdown formatting, no code fences, no backticks.`;
}

function buildWeeklySystemPrompt(holdingsUniverse) {
  return `You are a personal investing agent for a Finnish retail investor.
Generate a weekly portfolio review and forward-looking analysis.

HOLDINGS UNIVERSE:
${holdingsUniverse}

REVIEW RULES:
1. Synthesize the week's key developments — do not list every news item; find the through-line.
2. signals: include the current action for ALL holdings. Specify timeHorizon for each.
3. opportunities: 1-3 tactical opportunities visible in the context. May include positions outside current holdings if clearly supported by data.
4. Distinguish clearly between short-term (weeks), medium-term (months), and long-term (years) theses.
5. Never invent prices, percentages, or dates not present in the provided context. If data is missing, acknowledge it.
6. riskFlags: 2-4 risks that could materially affect the portfolio over the coming week.
7. Include at least one macro riskFlag if the news context contains a central bank decision, inflation data, or a geopolitical event.

RESPONSE FORMAT — always return valid JSON:
{
  "headline": "<one sentence — the dominant theme of the week>",
  "analysis": "<4-6 sentences — synthesized weekly review>",
  "signals": [
    { "ticker": "<symbol>", "action": "buy|sell|watch|hold", "timeHorizon": "short|medium|long", "reasoning": "<one sentence>" }
  ],
  "opportunities": ["<opportunity 1>", ...],
  "riskFlags": ["<risk 1>", ...],
  "confidence": "high|medium|low"
}

Return the JSON object directly — no markdown formatting, no code fences, no backticks.`;
}

// ── Benchmark fetch (IQQW.DE — iShares MSCI World) ────────────────────────────
// Direct AV call, intentionally separate from alphavantage-service.js.
// Runs at most once per weekly job (Monday 07:00 Helsinki) — not in the hot path.
// Week-over-week % derived from TIME_SERIES_WEEKLY (last two weekly closes).

async function fetchBenchmarkWeekPct() {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) return null;
  try {
    const url =
      `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=IQQW.DE&apikey=${key}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.Information || data.Note) return null;
    const series = data['Weekly Time Series'];
    if (!series) return null;
    const dates = Object.keys(series).sort((a, b) => b.localeCompare(a));
    if (dates.length < 2) return null;
    const thisClose = parseFloat(series[dates[0]]['4. close']);
    const lastClose = parseFloat(series[dates[1]]['4. close']);
    if (!thisClose || !lastClose) return null;
    return +((thisClose - lastClose) / lastClose * 100).toFixed(2);
  } catch {
    return null;
  }
}

// ── Portfolio assembly ────────────────────────────────────────────────────────

function buildPortfolioObj(stockResult, cryptoResult, allHoldings, geckoToTicker) {
  const holdingsMap = Object.fromEntries(allHoldings.map(h => [h.ticker, h]));
  const portfolio = {};

  for (const [ticker, data] of Object.entries(stockResult.prices ?? {})) {
    if (!data) continue;
    const priceEur = data.eur ?? data.price;
    const units    = holdingsMap[ticker]?.units ?? 0;
    portfolio[ticker] = {
      price:  priceEur,
      change: data.changePct ?? 0,
      value:  +(priceEur * units).toFixed(0),
    };
  }

  for (const [geckoId, data] of Object.entries(cryptoResult.prices ?? {})) {
    const ticker = geckoToTicker[geckoId];
    if (!ticker || !data) continue;
    const units = holdingsMap[ticker]?.units ?? 0;
    portfolio[ticker] = {
      price:  data.eur,
      change: data.eur_24h_change ?? 0,
      value:  +(data.eur * units).toFixed(0),
    };
  }

  return portfolio;
}

function computePortfolioSnapshot(portfolio) {
  let totalEur = 0, totalPrevEur = 0;
  for (const data of Object.values(portfolio)) {
    const v = data.value ?? 0;
    const c = data.change ?? 0;
    totalEur     += v;
    totalPrevEur += v / (1 + c / 100);
  }
  const dailyPnlEur = totalEur - totalPrevEur;
  const dailyPnlPct = totalPrevEur > 0 ? (dailyPnlEur / totalPrevEur) * 100 : 0;
  const movers = Object.entries(portfolio)
    .filter(([, d]) => d.change != null)
    .sort((a, b) => Math.abs(b[1].change) - Math.abs(a[1].change));
  return {
    totalEur:    Math.round(totalEur),
    dailyPnlEur: +dailyPnlEur.toFixed(0),
    dailyPnlPct: +dailyPnlPct.toFixed(2),
    topMover:    movers[0] ? { ticker: movers[0][0], changePct: movers[0][1].change } : null,
    asOf:        new Date().toISOString(),
  };
}

// ── Context builders ──────────────────────────────────────────────────────────

async function buildDailyContext() {
  const holdings = getHoldings();
  const allHoldings = [...(holdings.nordnet ?? []), ...(holdings.nordea ?? []), ...(holdings.kvarnx ?? [])];
  const geckoToTicker = Object.fromEntries(
    Object.entries(getCryptoIds()).map(([ticker, id]) => [id, ticker])
  );

  const [stockResult, cryptoResult, signalsResult] = await Promise.all([
    getStockPrices(),
    getCryptoPrices(),
    getSignals(),
  ]);
  const newsResult = getNewsFeed({});

  const portfolio         = buildPortfolioObj(stockResult, cryptoResult, allHoldings, geckoToTicker);
  const portfolioSnapshot = computePortfolioSnapshot(portfolio);
  const signals           = signalsResult.signals ?? [];
  const news              = newsResult.articles ?? [];
  const pricesAgeMin      = stockResult.cacheAgeMin ?? null;

  return {
    portfolio, signals, news,
    taxSummary: null, technicals: null,
    pricesAgeMin, portfolioSnapshot,
  };
}

async function buildWeeklyContext() {
  const [base, msciWorldWeekPct] = await Promise.all([
    buildDailyContext(),
    fetchBenchmarkWeekPct(),
  ]);

  const year    = new Date().getFullYear();
  const taxData = getTaxData(year);

  const taxSummary = taxData.error
    ? { realizedGains: 0, realizedLosses: 0, carryForward: 0, taxLiability: 0 }
    : {
        realizedGains:  Math.max(0, taxData.summary.combinedNet),
        realizedLosses: Math.abs(Math.min(0, taxData.summary.combinedNet)),
        carryForward:   taxData.summary.availableCarryForward,
        taxLiability:   taxData.summary.taxAfterCarry,
      };

  const taxYearRunningTotal = taxData.error ? null : {
    year:         taxData.year,
    combinedNet:  taxData.summary.combinedNet,
    taxLiability: taxData.summary.taxAfterCarry,
    taxSaving:    taxData.summary.taxSaving,
    carryForward: taxData.summary.availableCarryForward,
  };

  // portfolioWeekPct requires weekly price history — not tracked in the current
  // data layer (only daily change is available). Track via a future price-history
  // service if week-over-week portfolio performance is needed.
  const benchmarkComparison = {
    portfolioWeekPct: null,
    msciWorldWeekPct,
    note: msciWorldWeekPct != null
      ? 'Benchmark: iShares MSCI World (IQQW.DE)'
      : 'Benchmark data unavailable',
  };

  return { ...base, taxSummary, taxYearRunningTotal, benchmarkComparison };
}

// ── JSON parser (fence-stripping) ─────────────────────────────────────────────

function parseJobResponse(rawText) {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return { ok: true, parsed: JSON.parse(cleaned) };
  } catch (e) {
    return { ok: false, error: e.message, cleaned };
  }
}

// ── Claude API call ───────────────────────────────────────────────────────────

async function callClaudeForJob(systemPrompt, contextText, jobLabel, maxTokens = DAILY_MAX_TOKENS) {
  const budget = checkBudget();
  if (!budget.allowed) {
    console.log(`[ScheduledJob/${jobLabel}] Blocked by budget: ${budget.reason}`);
    return null;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(`[ScheduledJob/${jobLabel}] ANTHROPIC_API_KEY not set`);
    return null;
  }

  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.messages.create({
      model:      MODEL,
      max_tokens: maxTokens,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contextText },
      ],
      messages: [{ role: 'user', content: 'Generate the briefing now.' }],
    });
  } catch (err) {
    console.error(`[ScheduledJob/${jobLabel}] API call failed: ${err.message}`);
    return null;
  }

  const cost = calculateCost(response.usage);
  recordUsage(response.usage, cost);
  console.log(
    `[ScheduledJob/${jobLabel}] OK — ` +
    `in:${response.usage.input_tokens} ` +
    `cached:${response.usage.cache_read_input_tokens ?? 0} ` +
    `out:${response.usage.output_tokens} ` +
    `cost:$${cost.toFixed(6)}`
  );

  const rawText = response.content[0]?.text ?? '';
  const { ok, parsed, cleaned, error } = parseJobResponse(rawText);

  if (!ok) {
    console.warn(`[ScheduledJob/${jobLabel}] Response not valid JSON — wrapping raw: ${error}`);
    return {
      headline:    cleaned.slice(0, 200),
      _parseError: true,
      _meta:       { model: MODEL, usage: response.usage, cost },
    };
  }

  return { ...parsed, _meta: { model: MODEL, usage: response.usage, cost } };
}

// ── Phi-3.5 fallback ──────────────────────────────────────────────────────────

async function phiFallback(contextText, jobLabel) {
  console.log(`[ScheduledJob/${jobLabel}] Falling back to Phi-3.5...`);
  try {
    const text = await generateWithPhi(
      `You are an investing assistant. Summarize the key portfolio insights from this market data in 2-3 sentences:\n\n${contextText.slice(0, 2000)}`
    );
    return {
      headline: text.slice(0, 200),
      analysis: text,
      _meta:    { model: 'phi3.5', fallback: true },
    };
  } catch (err) {
    console.error(`[ScheduledJob/${jobLabel}] Phi fallback failed: ${err.message}`);
    return null;
  }
}

// ── Payload factories ─────────────────────────────────────────────────────────

function mockDailyPayload() {
  return {
    headline:        '[MOCK] Daily briefing — no API call was made.',
    keyInsights:     ['Mock mode active — set USE_CLAUDE_MOCK=false for real briefings.'],
    signalUpdates:   [],
    topNewsAnalysis: 'Mock mode is active. Real news analysis requires USE_CLAUDE_MOCK=false.',
    actionItems:     [],
    riskFlags:       [],
    confidence:      'low',
  };
}

function mockWeeklyPayload() {
  return {
    headline:      '[MOCK] Weekly report — no API call was made.',
    analysis:      'Mock mode is active. Real weekly analysis requires USE_CLAUDE_MOCK=false.',
    signals:       [],
    opportunities: [],
    riskFlags:     [],
    confidence:    'low',
  };
}

function hardcodedFallback(type) {
  const base = { headline: 'Agent offline — all generation paths failed.', confidence: 'low' };
  return type === 'daily'
    ? { ...base, keyInsights: [], signalUpdates: [], topNewsAnalysis: '', actionItems: [], riskFlags: [] }
    : { ...base, analysis: '', signals: [], opportunities: [], riskFlags: [] };
}

// ── Public orchestrators ──────────────────────────────────────────────────────

export async function generateDailyBriefing() {
  console.log('[ScheduledJob/daily] Starting...');

  const contextObj              = await buildDailyContext();
  const { text: contextText }   = compressContext(contextObj);

  let payload, source;

  if (USE_MOCK) {
    console.log('[ScheduledJob/daily] USE_MOCK=true — skipping Claude API call');
    payload = mockDailyPayload();
    source  = 'mock';
  } else {
    const claudeResult = await callClaudeForJob(buildDailySystemPrompt(buildHoldingsUniverse()), contextText, 'daily', DAILY_MAX_TOKENS);
    if (claudeResult) {
      payload = claudeResult;
      source  = 'claude';
    } else {
      const phiResult = await phiFallback(contextText, 'daily');
      payload = phiResult ?? hardcodedFallback('daily');
      source  = phiResult ? 'phi' : 'hardcoded';
    }
  }

  const { _meta, ...claudeFields } = payload;
  const result = {
    type:             'daily_briefing',
    generatedAt:      new Date().toISOString(),
    source,
    ...claudeFields,
    portfolioSnapshot: contextObj.portfolioSnapshot,
    budgetStatus:      getStatus(),
    _meta:             _meta ?? null,
  };

  console.log(`[ScheduledJob/daily] Done — source:${source}`);
  return result;
}

export async function generateWeeklyReport() {
  console.log('[ScheduledJob/weekly] Starting...');

  const contextObj            = await buildWeeklyContext();
  const { text: contextText } = compressContext(contextObj);

  let payload, source;

  if (USE_MOCK) {
    console.log('[ScheduledJob/weekly] USE_MOCK=true — skipping Claude API call');
    payload = mockWeeklyPayload();
    source  = 'mock';
  } else {
    const claudeResult = await callClaudeForJob(buildWeeklySystemPrompt(buildHoldingsUniverse()), contextText, 'weekly', WEEKLY_MAX_TOKENS);
    if (claudeResult) {
      payload = claudeResult;
      source  = 'claude';
    } else {
      const phiResult = await phiFallback(contextText, 'weekly');
      payload = phiResult ?? hardcodedFallback('weekly');
      source  = phiResult ? 'phi' : 'hardcoded';
    }
  }

  const { _meta, ...claudeFields } = payload;
  const result = {
    type:                'weekly_report',
    generatedAt:         new Date().toISOString(),
    source,
    ...claudeFields,
    portfolioSnapshot:   contextObj.portfolioSnapshot,
    taxYearRunningTotal: contextObj.taxYearRunningTotal,
    benchmarkComparison: contextObj.benchmarkComparison,
    budgetStatus:        getStatus(),
    _meta:               _meta ?? null,
  };

  console.log(`[ScheduledJob/weekly] Done — source:${source}`);
  return result;
}
