// backend/services/openrouter-usage-service.js
//
// Daily request counter for the OpenRouter free tier, backed by Upstash
// Redis (SCRUM-59) instead of a local flat file (SCRUM-56). Redis's INCRBY
// is atomic, so the proper-lockfile locking SCRUM-56 added is gone -- that
// existed specifically to protect a non-atomic local read-modify-write,
// which no longer exists here. More importantly: this state now survives
// Render's free-tier spin-down/spin-up cycles. SCRUM-56's verification
// pass found the flat-file version didn't -- local disk is wiped on every
// restart, so "stop as we near 50/day" was silently resetting every
// ~15 minutes of idle time.

import { redis } from './redis-client.js';

export const LIMITS = {
  dailyCap:      50, // OpenRouter's hard account-wide ceiling at $0 balance
  dailySoftStop: 45, // stop attempting live calls once today's count reaches this
};

const KEY_TTL_SECONDS = 26 * 60 * 60; // safety-margin self-cleanup around the UTC day boundary

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function usageKey() {
  return `openrouter:usage:${todayStr()}`;
}

/** How many OpenRouter requests are safe to make right now without crossing dailySoftStop. */
export async function remainingBudget() {
  const count = Number(await redis.get(usageKey())) || 0;
  return Math.max(0, LIMITS.dailySoftStop - count);
}

/**
 * Record N actual OpenRouter API requests — successes AND failures both
 * count, since every attempt consumes one of the account's 50/day
 * regardless of whether the model responded usefully.
 */
export async function recordRequests(count) {
  if (count <= 0) return;
  const key = usageKey();
  const newCount = await redis.incrby(key, count);
  if (newCount === count) {
    // This write created the key (first request recorded today) — the
    // key expiring itself replaces the flat-file version's manual date
    // field + rollover check.
    await redis.expire(key, KEY_TTL_SECONDS);
  }
}

export async function getStatus() {
  const count = Number(await redis.get(usageKey())) || 0;
  return {
    date: todayStr(),
    requestCount: count,
    dailyCap: LIMITS.dailyCap,
    dailySoftStop: LIMITS.dailySoftStop,
    remaining: Math.max(0, LIMITS.dailySoftStop - count),
  };
}
