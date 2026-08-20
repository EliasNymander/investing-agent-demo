// backend/routes/chat.js
import { Router } from 'express';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '../services/redis-client.js';
import { chatWithOpenRouter, FREE_MODELS } from '../services/openrouter-client.js';
import { remainingBudget, recordRequests } from '../services/openrouter-usage-service.js';
import { canUseLiveReply, recordLiveReply, getSessionStatus } from '../services/chat-session-service.js';

const router = Router();

const MOCK_REPLIES = {
  rate_limited:
    "You've hit this demo's per-visitor rate limit for live AI replies (it's a shared free-tier pool). " +
    "Here's a static response instead — the agent would normally reason over your portfolio, signals, and recent news.",
  session_cap:
    "You've used up this session's live AI replies — this demo shares a small daily quota across every visitor. " +
    "Take a look at the Dashboard, Signals, and Intelligence pages for the data the agent would reason over.",
  budget_exhausted:
    "This demo's shared daily AI quota is nearly used up for today. Here's a static response instead — " +
    "the live version resets tomorrow.",
  upstream_failure:
    "Live AI chat is temporarily unavailable (the free model pool is having issues right now). " +
    "Here's a static response instead — take a look at the Dashboard, Signals, and Intelligence pages.",
  protection_unavailable:
    "This demo's usage-tracking is temporarily unavailable, so live AI chat is paused as a precaution rather than " +
    "risking the shared daily quota. Here's a static response instead — take a look at the Dashboard, Signals, and Intelligence pages.",
};

function buildMockReply(reason) {
  return { success: true, source: 'mock', reason, reply: MOCK_REPLIES[reason] ?? MOCK_REPLIES.upstream_failure };
}

// Cloudflare (Render's edge) sets this header authoritatively and
// overwrites any client-supplied value -- unlike X-Forwarded-For, a client
// can't spoof it by prepending fake entries. Falls back to req.ip for
// local dev, where this header won't be present.
function clientIp(req) {
  return req.headers['true-client-ip'] ?? req.ip;
}

// Per-IP: 5 requests / rolling 24h, now backed by Redis (SCRUM-59) so it
// actually survives Render's free-tier spin-down/spin-up cycles -- the
// in-memory express-rate-limit store from SCRUM-56 reset on every restart.
// Sized against OpenRouter's 50/day account-wide cap shared by every
// anonymous demo visitor: caps any single IP at 10% of the whole day's
// budget. The session cap below is the primary control for the normal
// case; this is the backstop against clearing sessionStorage for a fresh
// "session".
const chatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '24 h'),
  prefix: 'chat:ratelimit',
});

router.post('/', async (req, res) => {
  const { query, sessionId } = req.body ?? {};

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ success: false, error: "Missing 'query' in request body" });
  }

  let rateLimitOk;
  try {
    ({ success: rateLimitOk } = await chatRateLimit.limit(clientIp(req)));
  } catch (err) {
    console.error(`[chat route] rate limit check failed, failing closed to mock: ${err.message}`);
    return res.json(buildMockReply('protection_unavailable'));
  }
  if (!rateLimitOk) {
    return res.json(buildMockReply('rate_limited'));
  }

  let sessionOk;
  try {
    sessionOk = await canUseLiveReply(sessionId);
  } catch (err) {
    console.error(`[chat route] session-cap check failed, failing closed to mock: ${err.message}`);
    return res.json(buildMockReply('protection_unavailable'));
  }
  if (!sessionOk) {
    return res.json(buildMockReply('session_cap'));
  }

  let budget;
  try {
    budget = await remainingBudget();
  } catch (err) {
    console.error(`[chat route] budget check failed, failing closed to mock: ${err.message}`);
    return res.json(buildMockReply('protection_unavailable'));
  }
  if (budget <= 0) {
    return res.json(buildMockReply('budget_exhausted'));
  }

  const modelsToTry = FREE_MODELS.slice(0, Math.max(1, Math.min(FREE_MODELS.length, budget)));

  try {
    const result = await chatWithOpenRouter(query.trim(), { models: modelsToTry });

    try {
      await recordRequests(result.attempts);
      await recordLiveReply(sessionId);
    } catch (bookErr) {
      // The reply already happened and cost real quota -- deliver it
      // rather than discard it over a bookkeeping failure.
      console.error(`[chat route] failed to record successful usage (reply still delivered): ${bookErr.message}`);
    }

    let sessionStatus = null;
    try { sessionStatus = await getSessionStatus(sessionId); } catch { /* non-critical */ }

    return res.json({ success: true, source: 'openrouter', model: result.model, reply: result.text, sessionStatus });
  } catch (err) {
    console.error(`[chat route] OpenRouter exhausted: ${err.message}`);
    try {
      await recordRequests(modelsToTry.length); // every model in the attempted list was actually called
    } catch (bookErr) {
      console.error(`[chat route] failed to record exhausted-attempt usage: ${bookErr.message}`);
    }
    return res.json(buildMockReply('upstream_failure'));
  }
});

export default router;
