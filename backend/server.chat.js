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
