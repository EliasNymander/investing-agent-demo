// backend/services/openrouter-usage-service.js
//
// Daily request counter for the OpenRouter free tier, modeled on the
// flat-file day-rollover pattern used elsewhere in this backend — with
// its own file locking layered on top, not reused from anywhere: this
// repo's claude-budget-service.js has no locking at all (plain
// readFileSync/writeFileSync). Any lockSyncWithRetry() helper implied by
// that name lives only in the private repo's version of that file, if
// it exists there — not assuming parity here.
//
// Locking matters more for this file than it would for a single-user
// budget log: this counter is written by concurrent anonymous public
// traffic. Two requests both reading requestCount: 44 before either
// writes back 45 would silently under-count — and the account could
// exceed OpenRouter's real 50/day hard cap without the soft-stop ever
// seeing it coming, which is exactly the failure mode the soft-stop
// exists to prevent.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import lockfile from 'proper-lockfile';

const __dir = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dir, '..', 'cache');
const LOG_FILE = join(CACHE_DIR, 'openrouter_usage_log.json');

export const LIMITS = {
  dailyCap:      50, // OpenRouter's hard account-wide ceiling at $0 balance
  dailySoftStop: 45, // stop attempting live calls once today's count reaches this
};

// proper-lockfile's retries option is documented for the async .lock() API,
// not lockSync() — rather than trust an unconfirmed sync retry option, this
// polls lockSync() itself. Kept small: on Render's free tier (single
// instance, per Commit 1) two Node *processes* never actually contend for
// this file, so retries are a rare safety net (e.g. a lock left briefly
// stale across a redeploy overlap), not a normal-case cost. Worst case is
// a short synchronous stall, not a hang.
const LOCK_RETRIES = 5;
const LOCK_RETRY_DELAY_MS = 20;
const LOCK_STALE_MS = 5000; // treat a lock older than this as abandoned (e.g. a crashed process)

function ensureDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function ensureLogFileExists() {
  ensureDir();
  // proper-lockfile (default realpath: true) requires the target file to
  // already exist before it can be locked. Creating it here is not itself
  // lock-protected — the only possible race is two processes both writing
  // the same fresh { date, requestCount: 0 }, which is a harmless
  // redundant write, not a lost update.
  if (!existsSync(LOG_FILE)) {
    writeFileSync(LOG_FILE, JSON.stringify({ date: todayStr(), requestCount: 0 }, null, 2), 'utf-8');
  }
}

function lockSyncWithRetry(file) {
  let lastErr;
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    try {
      return lockfile.lockSync(file, { stale: LOCK_STALE_MS });
    } catch (err) {
      lastErr = err;
      const until = Date.now() + LOCK_RETRY_DELAY_MS;
      while (Date.now() < until) { /* brief synchronous spin — see note above */ }
    }
  }
  throw new Error(`[openrouter-usage-service] Could not acquire lock on ${file}: ${lastErr?.message}`);
}

function withLock(fn) {
  ensureLogFileExists();
  const release = lockSyncWithRetry(LOG_FILE);
  try {
    return fn();
  } finally {
    release();
  }
}

function loadLog() {
  let log;
  try {
    log = JSON.parse(readFileSync(LOG_FILE, 'utf-8'));
  } catch {
    log = { date: todayStr(), requestCount: 0 };
  }
  if (log.date !== todayStr()) log = { date: todayStr(), requestCount: 0 };
  return log;
}

function saveLog(log) {
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

/** How many OpenRouter requests are safe to make right now without crossing dailySoftStop. */
export function remainingBudget() {
  return withLock(() => Math.max(0, LIMITS.dailySoftStop - loadLog().requestCount));
}

/**
 * Record N actual OpenRouter API requests — successes AND failures both
 * count, since every attempt consumes one of the account's 50/day
 * regardless of whether the model responded usefully.
 */
export function recordRequests(count) {
  if (count <= 0) return;
  withLock(() => {
    const log = loadLog();
    log.requestCount += count;
    saveLog(log);
  });
}

export function getStatus() {
  return withLock(() => {
    const log = loadLog();
    return {
      ...log,
      dailyCap: LIMITS.dailyCap,
      dailySoftStop: LIMITS.dailySoftStop,
      remaining: Math.max(0, LIMITS.dailySoftStop - log.requestCount),
    };
  });
}
