// frontend/src/api/chatBackend.js
//
// Talks to the Render-deployed chat-only backend (SCRUM-56). The backend
// owns the OpenRouter→mock fallback decision (rate limits, session cap,
// daily budget) — this module's only job is reaching that backend at all,
// with a bounded timeout so a cold Render instance (30-60s wake time)
// doesn't hang the chat UI. Any failure to reach it falls back to a local
// canned message — a network-level safety net, not a duplicate of the
// backend's own fallback logic.

const CHAT_BACKEND_URL = import.meta.env.VITE_CHAT_BACKEND_URL;
const REQUEST_TIMEOUT_MS = 15_000;
const SESSION_KEY = 'ia_chat_session_id';

const UNREACHABLE_MESSAGE =
  "Live AI chat couldn't be reached right now (this demo's backend sleeps when idle and can take a " +
  "moment to wake up — try again in a bit). Here's a static response instead: take a look at the " +
  "Dashboard, Signals, and Intelligence pages to see the data the agent would reason over.";

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function sendChatMessage(query) {
  if (!CHAT_BACKEND_URL) {
    return { success: true, source: 'mock', reason: 'no_backend_configured', reply: UNREACHABLE_MESSAGE };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${CHAT_BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, sessionId: getSessionId() }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`chat backend returned ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[chatBackend] request failed, falling back to mock:', err.message);
    return { success: true, source: 'mock', reason: 'unreachable', reply: UNREACHABLE_MESSAGE };
  } finally {
    clearTimeout(timeout);
  }
}
