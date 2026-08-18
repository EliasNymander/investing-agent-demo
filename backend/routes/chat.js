// backend/routes/chat.js
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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
};

function buildMockReply(reason) {
  return { success: true, source: 'mock', reason, reply: MOCK_REPLIES[reason] ?? MOCK_REPLIES.upstream_failure };
}

// Per-IP: 5 requests / rolling 24h. Sized against OpenRouter's 50/day
// account-wide cap shared by every anonymous demo visitor — this caps any
// single IP at 10% of the whole day's budget, so one visitor (or a script
// hammering the endpoint) can't exhaust it alone. The session cap below is
// the primary control for the normal case; this is the backstop against
// clearing sessionStorage to get a fresh "session".
const chatRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.json(buildMockReply('rate_limited')),
});

router.post('/', chatRateLimit, async (req, res) => {
  const { query, sessionId } = req.body ?? {};

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ success: false, error: "Missing 'query' in request body" });
  }

  if (!canUseLiveReply(sessionId)) {
    return res.json(buildMockReply('session_cap'));
  }

  const budget = remainingBudget();
  if (budget <= 0) {
    return res.json(buildMockReply('budget_exhausted'));
  }

  const modelsToTry = FREE_MODELS.slice(0, Math.max(1, Math.min(FREE_MODELS.length, budget)));

  try {
    const result = await chatWithOpenRouter(query.trim(), { models: modelsToTry });
    recordRequests(result.attempts);
    recordLiveReply(sessionId);
    return res.json({
      success: true,
      source: 'openrouter',
      model: result.model,
      reply: result.text,
      sessionStatus: getSessionStatus(sessionId),
    });
  } catch (err) {
    console.error(`[chat route] OpenRouter exhausted: ${err.message}`);
    recordRequests(modelsToTry.length); // every model in the attempted list was actually called
    return res.json(buildMockReply('upstream_failure'));
  }
});

export default router;
