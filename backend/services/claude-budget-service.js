import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dir, '..', 'cache');
const LOG_FILE = join(CACHE_DIR, 'claude_usage_log.json');

// ── Budget limits ─────────────────────────────────────────────────────────────

export const LIMITS = {
  dailyHard:       0.07,   // hard block — no calls beyond this
  dailySoft:       0.05,   // soft warning — calls still allowed, UI warns
  monthlyHard:     2.15,   // hard block for the month
  monthlySoft:     1.80,   // soft warning for the month
  dailyCallCap:    5,      // secondary safety net — max calls/day regardless of cost
  maxInputTokens:  4000,   // per-call token limit (input)
  maxOutputTokens: 1000,   // per-call token limit (output)
};

// Sonnet 4.6 pricing (USD per token)
export const RATES = {
  input:       0.000003,    // $3.00 / 1M tokens
  cachedInput: 0.0000003,   // $0.30 / 1M tokens (90% cache discount)
  output:      0.000015,    // $15.00 / 1M tokens
};

// ── File helpers ──────────────────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function monthStr() {
  return new Date().toISOString().substring(0, 7);
}

function emptyDayEntry() {
  return { spend: 0.0, callCount: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
}

function freshLog() {
  return {
    currentMonth: monthStr(),
    monthlySpend: 0.0,
    monthlyCallCount: 0,
    dailyLog: { [todayStr()]: emptyDayEntry() },
    alerts: { softDailyHit: false, hardDailyHit: false, softMonthlyHit: false, hardMonthlyHit: false },
  };
}

function loadLog() {
  ensureDir();
  let log;
  try {
    log = JSON.parse(readFileSync(LOG_FILE, 'utf-8'));
  } catch {
    return freshLog();
  }

  const today = todayStr();
  const month = monthStr();

  // Monthly rollover
  if (log.currentMonth !== month) {
    log.currentMonth = month;
    log.monthlySpend = 0.0;
    log.monthlyCallCount = 0;
    log.alerts.softMonthlyHit = false;
    log.alerts.hardMonthlyHit = false;
  }

  // Daily rollover — ensure today's entry exists, reset daily alert flags if new day
  if (!log.dailyLog[today]) {
    log.dailyLog[today] = emptyDayEntry();
    log.alerts.softDailyHit = false;
    log.alerts.hardDailyHit = false;
  }

  return log;
}

function saveLog(log) {
  ensureDir();
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

// ── Cost calculation ──────────────────────────────────────────────────────────

/**
 * Calculates the USD cost of a single API call from Anthropic's usage object.
 * usage = { input_tokens, output_tokens, cache_read_input_tokens?, cache_creation_input_tokens? }
 */
export function calculateCost(usage) {
  const input  = (usage.input_tokens              ?? 0) * RATES.input;
  const cached = (usage.cache_read_input_tokens   ?? 0) * RATES.cachedInput;
  const output = (usage.output_tokens             ?? 0) * RATES.output;
  return +(input + cached + output).toFixed(8);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether a Claude API call is permitted under current budget limits.
 * Must be called BEFORE every API call.
 *
 * Returns:
 *   { allowed: true, softWarning: bool, softWarningMessage: string|null }
 *   { allowed: false, reason: string, message: string }
 *
 * reason values: 'daily_cap' | 'monthly_cap' | 'daily_call_cap'
 */
export function checkBudget() {
  const log = loadLog();
  const today = todayStr();
  const day = log.dailyLog[today];

  // Hard block: daily call count
  if (day.callCount >= LIMITS.dailyCallCap) {
    return {
      allowed: false,
      reason: 'daily_call_cap',
      message: `Daily call cap of ${LIMITS.dailyCallCap} reached. Resets at midnight.`,
      softWarning: false,
      softWarningMessage: null,
    };
  }

  // Hard block: daily spend — also block if remaining headroom can't cover a minimum call cost
  // (minCallCost = maxOutputTokens × output rate = $0.015, assuming fully-cached input)
  const minCallCost = LIMITS.maxOutputTokens * RATES.output;
  if (day.spend + minCallCost > LIMITS.dailyHard) {
    if (!log.alerts.hardDailyHit) { log.alerts.hardDailyHit = true; saveLog(log); }
    return {
      allowed: false,
      reason: 'daily_cap',
      message: `Daily Claude budget of $${LIMITS.dailyHard.toFixed(2)} reached. Resets at midnight.`,
      softWarning: false,
      softWarningMessage: null,
    };
  }

  // Hard block: monthly spend
  if (log.monthlySpend >= LIMITS.monthlyHard) {
    if (!log.alerts.hardMonthlyHit) { log.alerts.hardMonthlyHit = true; saveLog(log); }
    return {
      allowed: false,
      reason: 'monthly_cap',
      message: `Monthly Claude budget of $${LIMITS.monthlyHard.toFixed(2)} reached. Resets on the 1st.`,
      softWarning: false,
      softWarningMessage: null,
    };
  }

  // Soft warnings (call still allowed — update flags if newly crossed)
  const softDailyWarn   = day.spend >= LIMITS.dailySoft;
  const softMonthlyWarn = log.monthlySpend >= LIMITS.monthlySoft;
  let flagsDirty = false;

  if (softDailyWarn && !log.alerts.softDailyHit) {
    log.alerts.softDailyHit = true;
    flagsDirty = true;
  }
  if (softMonthlyWarn && !log.alerts.softMonthlyHit) {
    log.alerts.softMonthlyHit = true;
    flagsDirty = true;
  }
  if (flagsDirty) saveLog(log);

  const softWarning = softDailyWarn || softMonthlyWarn;
  const softWarningMessage = softDailyWarn
    ? `Daily spend at $${day.spend.toFixed(4)} — approaching daily cap of $${LIMITS.dailyHard}`
    : softMonthlyWarn
    ? `Monthly spend at $${log.monthlySpend.toFixed(4)} — approaching monthly cap of $${LIMITS.monthlyHard}`
    : null;

  return { allowed: true, reason: null, message: null, softWarning, softWarningMessage };
}

/**
 * Record usage AFTER a successful Claude API call.
 * usage = Anthropic response.usage object
 * cost  = calculateCost(usage)
 */
export function recordUsage(usage, cost) {
  const log = loadLog();
  const today = todayStr();
  const day = log.dailyLog[today];

  day.spend             = +(day.spend + cost).toFixed(8);
  day.callCount         += 1;
  day.inputTokens       += usage.input_tokens              ?? 0;
  day.outputTokens      += usage.output_tokens             ?? 0;
  day.cachedInputTokens += usage.cache_read_input_tokens   ?? 0;

  log.monthlySpend     = +(log.monthlySpend + cost).toFixed(8);
  log.monthlyCallCount += 1;

  // Keep alert flags in sync with new totals
  if (day.spend >= LIMITS.dailySoft)        log.alerts.softDailyHit   = true;
  if (day.spend >= LIMITS.dailyHard)        log.alerts.hardDailyHit   = true;
  if (log.monthlySpend >= LIMITS.monthlySoft) log.alerts.softMonthlyHit = true;
  if (log.monthlySpend >= LIMITS.monthlyHard) log.alerts.hardMonthlyHit = true;

  saveLog(log);
}

/**
 * Returns the full budget status snapshot.
 * Used by the UI BudgetWidget and by claudeClient.js for pre-call checks.
 */
export function getStatus() {
  const log = loadLog();
  const today = todayStr();
  const day = log.dailyLog[today] ?? emptyDayEntry();

  return {
    dailySpend:          day.spend,
    dailyCap:            LIMITS.dailyHard,
    dailyCallCount:      day.callCount,
    dailyCallCap:        LIMITS.dailyCallCap,
    dailyPercentUsed:    Math.min(100, Math.round((day.spend / LIMITS.dailyHard) * 100)),
    callsRemainingToday: Math.max(0, LIMITS.dailyCallCap - day.callCount),
    monthlySpend:        log.monthlySpend,
    monthlyCap:          LIMITS.monthlyHard,
    monthlyCallCount:    log.monthlyCallCount,
    monthlyPercentUsed:  Math.min(100, Math.round((log.monthlySpend / LIMITS.monthlyHard) * 100)),
    alerts:              log.alerts,
    currentMonth:        log.currentMonth,
  };
}

/**
 * Directly write a field into the log — used by tests and manual overrides only.
 * field: 'monthlySpend' | 'dailySpend' | 'dailyCallCount'
 */
export function _forceSetForTesting(field, value) {
  const log = loadLog();
  const today = todayStr();
  if (field === 'monthlySpend')      log.monthlySpend = value;
  if (field === 'monthlyCallCount')  log.monthlyCallCount = value;
  if (field === 'dailySpend')        log.dailyLog[today].spend = value;
  if (field === 'dailyCallCount')    log.dailyLog[today].callCount = value;
  // Reset derived alert flags so they recalculate on next checkBudget()
  log.alerts = { softDailyHit: false, hardDailyHit: false, softMonthlyHit: false, hardMonthlyHit: false };
  saveLog(log);
}
