// backend/services/chat-session-service.js
//
// Per-visitor-session cap on live AI replies, backed by Upstash Redis
// (SCRUM-59) instead of an in-memory Map (SCRUM-56) -- the in-memory
// version reset on every Render free-tier spin-down/spin-up, silently
// giving every visitor a fresh cap each time the service slept. Redis's
// key expiration replaces the manual SESSION_TTL_MS/cleanup() sweep.

import { redis } from './redis-client.js';

export const SESSION_LIVE_REPLY_CAP = 3;
const SESSION_TTL_SECONDS = 24 * 60 * 60;

function sessionKey(sessionId) {
  return `chat:session:${sessionId}`;
}

export async function canUseLiveReply(sessionId) {
  if (!sessionId) return false; // no session id — treat as exhausted, not exempt
  const count = Number(await redis.get(sessionKey(sessionId))) || 0;
  return count < SESSION_LIVE_REPLY_CAP;
}

export async function recordLiveReply(sessionId) {
  if (!sessionId) return;
  const key = sessionKey(sessionId);
  const newCount = await redis.incr(key);
  if (newCount === 1) {
    await redis.expire(key, SESSION_TTL_SECONDS);
  }
}

export async function getSessionStatus(sessionId) {
  const count = Number(await redis.get(sessionKey(sessionId))) || 0;
  return { used: count, cap: SESSION_LIVE_REPLY_CAP, remaining: Math.max(0, SESSION_LIVE_REPLY_CAP - count) };
}
