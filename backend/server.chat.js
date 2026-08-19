// backend/server.chat.js
//
// Minimal Express entrypoint for the Render deployment (SCRUM-56).
// Exposes only what the public demo's live-chat feature needs — NOT the
// full private-app backend (server.js). No portfolio/holdings/tax/etc.
// routers, no node-cron scheduler, no demo-mode toggle. Everything else
// the frontend needs is already served client-side by demoFetch.js's
// static fixtures; this process exists solely to proxy OpenRouter calls
// for the chat panel.

import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Render sits behind a reverse-proxy chain (Cloudflare edge + Render's own
// load balancer) -- without this, Express's req.ip/req.protocol resolve
// against the nearest proxy, not the real visitor. Render doesn't document
// the exact hop count (checked); 3 is a community-tested value I could not
// independently verify (the only source, a Render community thread, is
// unreachable from here -- DNS resolution to render.discourse.group fails
// consistently). Kept as a reasonable default for Express's general
// proxy-aware behavior. The rate limiter itself (routes/chat.js) doesn't
// depend on this number being exactly right -- it reads the Cloudflare-set
// True-Client-IP header directly, which callers can't spoof.
app.set('trust proxy', 3);

// Restrict to this project's Vercel domains (prod + preview deployments)
// plus local frontend dev — this is a public free-tier OpenRouter proxy,
// no reason to let arbitrary third-party sites embed it.
const ALLOWED_ORIGIN_RE = /^https:\/\/investing-agent-demo(-[a-z0-9-]+)?\.vercel\.app$/;
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // health checks / curl / no-origin requests
    if (ALLOWED_ORIGIN_RE.test(origin) || origin === 'http://localhost:5173') {
      return callback(null, true);
    }
    callback(new Error(`Origin not allowed: ${origin}`));
  },
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/chat', chatRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'chat-only', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Investing Agent chat-only API running on port ${PORT}`);
});
