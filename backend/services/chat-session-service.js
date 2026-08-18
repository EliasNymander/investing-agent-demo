// backend/services/chat-session-service.js
//
// Per-visitor-session cap on live AI replies. Sessions are anonymous and
// client-generated (see frontend/src/api/chatBackend.js) — tracked
// in-memory only, not in the flat-file log (that one's the shared daily
// budget; this is a per-visitor cap on top of it).

export const SESSION_LIVE_REPLY_CAP = 3;

const sessions = new Map(); // sessionId -> { count, lastSeen }
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function cleanup() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) {
    if (s.lastSeen < cutoff) sessions.delete(id);
  }
}

export function canUseLiveReply(sessionId) {
  if (!sessionId) return false; // no session id — treat as exhausted, not exempt
  cleanup();
  const s = sessions.get(sessionId);
  return !s || s.count < SESSION_LIVE_REPLY_CAP;
}

export function recordLiveReply(sessionId) {
  if (!sessionId) return;
  const s = sessions.get(sessionId) ?? { count: 0, lastSeen: Date.now() };
  s.count += 1;
  s.lastSeen = Date.now();
  sessions.set(sessionId, s);
}

export function getSessionStatus(sessionId) {
  const used = sessions.get(sessionId)?.count ?? 0;
  return { used, cap: SESSION_LIVE_REPLY_CAP, remaining: Math.max(0, SESSION_LIVE_REPLY_CAP - used) };
}
