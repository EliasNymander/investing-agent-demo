# Investing Agent

<!-- Screenshot: dashboard.png -->

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white) ![License](https://img.shields.io/badge/license-MIT-blue) ![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black) ![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)

A self-hostable portfolio dashboard and AI agent for Nordic investors, open-sourced as a portfolio/demo project. Tracks stocks, ETFs, funds, and crypto across three account types in real time, and layers an AI agent on top with live access to your actual holdings — daily briefings, weekly deep-dive reports, and buy/sell signals generated from your real portfolio data, not generic market commentary.

**[Live Demo](DEMO_URL_PLACEHOLDER)** · Or clone it and run the full thing yourself — see below.

---

## Try It

**[Live Demo](DEMO_URL_PLACEHOLDER)** is a hosted, read-only instance running the bundled Sample Nordic Investor portfolio (a fictional demo dataset, not real holdings). Browse the dashboard, signals, intelligence feed, tax summary, and reports exactly as a real user would see them. It's frontend-only — **AI chat is disabled on the hosted demo**, since enabling it would mean sharing a live Anthropic key with every visitor.

To use the full agentic feature set — chat, on-demand signal generation, live analysis grounded in your own data — clone the repo and connect your own AI brain: Ollama running locally (free), or your own Anthropic API key (cheap; see **Cost discipline** below). See **Installation**.

## Demo Data vs. Your Own Portfolio

This repo runs out of the box on baked-in demo data — a fictional "Sample Nordic Investor" portfolio spanning Nordic equities, global ETFs, a couple of funds, and a small crypto sleeve — with realistic prices, signals, news, and a full tax scenario (including a realized gain and a realized loss offsetting each other) already populated. **Demo mode is on by default** — clone it, `npm install`, start both servers, and you get a fully populated dashboard immediately with zero configuration and no API keys.

When you're ready to enter your own holdings, toggle demo mode off in **Settings** (or `POST /api/demo/disable`) and use the Setup Wizard. That toggle persists — once you've switched to your real accounts, restarting the app won't silently pull you back into demo mode. Your real data lives in gitignored local JSON files (`backend/data/accounts/`) and is never mixed with the demo data — the two are structurally separate code paths, not a data swap.

**Demo mode and `USE_CLAUDE_MOCK` are two independent switches, not one:**
- **Demo mode** controls *which holdings you see* — the bundled Sample Nordic Investor portfolio vs. your real accounts.
- **`USE_CLAUDE_MOCK`** (an env variable in `.env`, defaults to `true`) controls *whether AI-generated text is real* — chat replies and daily/weekly briefings either come from the live Anthropic API or from canned example responses.

They don't require each other. You can browse the full demo portfolio with live AI analysis (add a real `ANTHROPIC_API_KEY` and set `USE_CLAUDE_MOCK=false`, leave demo mode on), or run your real portfolio with placeholder AI text (demo mode off, `USE_CLAUDE_MOCK` left at its default). Out of the box, both default to the no-API-key-needed setting, so a fresh clone shows a fully populated demo dashboard with mock AI text — the fastest path to seeing everything working.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, SWR, Recharts |
| Backend | Node.js, Express |
| Local AI | Ollama + Phi-3.5-mini |
| Cloud AI | Anthropic Claude API (claude-sonnet-4-6) |
| Stock/ETF prices | Alpha Vantage API |
| Crypto prices | CoinGecko API |
| Fund NAV prices | Yahoo Finance (ISIN lookup) |
| FX rates | European Central Bank (ECB) XML feed |
| News | NewsAPI |
| Scheduling | node-cron |
| Data persistence | JSON flat files (no database) |

---

## What It Does

### Portfolio Dashboard
Net worth and daily P&L across all accounts in real time. Positions with daily moves above ±3% or ±5% are flagged automatically. Prices from Alpha Vantage (stocks/ETFs), CoinGecko (crypto), and Yahoo Finance (ISIN-mapped funds), with live EUR/SEK from the ECB.

### AI Agent Chat
Ask questions about your portfolio in plain language. Lightweight queries ("what's my BTC price?") are handled locally by Phi-3.5 in milliseconds. Complex analysis ("analyse my semiconductor exposure given today's news") escalates to Claude with full portfolio context. Routing is automatic.

### Buy/Sell Signals
Each signal includes a trigger, upside case, risk assessment, and recommended action. Labelled 🟢 BUY / 🔴 SELL / 🟡 WATCH with a staleness indicator showing when they were last generated.

### Intelligence Feed
Financial news filtered to your specific holdings, tagged by ticker and scored for sentiment. Articles split across four tabs — **Portfolio** (news on what you hold), **Market & Macro** (broad, ticker-agnostic events like rate decisions), **Opportunities** (ideas you're evaluating but don't own), and **Watchlist** (tickers you've explicitly added to your live watchlist). Ideas you're considering surface in Opportunities without cluttering your portfolio feed.

### Daily Alerts & Weekly Reports
Scheduled briefings generated by Claude with your live portfolio as context. Daily alerts are short and scannable. Weekly reports cover performance, technicals (RSI, MACD, moving averages), macro signals, and opportunities. Both can be triggered on demand via the UI or API.

### Tax Summary
Realised gains and losses per account with Finnish capital gains tax calculated automatically (30%/34% brackets). Manual transaction entry for platforms without an export API.

### Multi-Account Support
Separate investment accounts (e.g. stocks/ETFs and crypto) managed from one dashboard. Switch accounts in the nav bar. Holdings, signals, and tax summaries are all account-scoped.

### Setup Wizard
Guided first-run flow for entering holdings, configuring API keys, and setting report schedules — no file editing required.

---

## Architecture

All data stays on your machine. No third-party cloud storage, no SaaS subscriptions beyond the APIs you configure yourself.

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React)                │
│  Dashboard · Chat · Signals · Alerts · Tax · ... │
└────────────────────┬────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────┐
│              Backend (Node.js + Express)          │
│  Routes: portfolio, agent, alerts, analytics ... │
│  Services: Alpha Vantage · CoinGecko · NewsAPI   │
│            ECB FX · Yahoo Finance · Scheduler    │
└──────────┬──────────────────────────┬────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────┐
│  Local Agent Brain  │   │   Claude API (Cloud) │
│  (Phi-3.5 / Ollama) │   │  Deep analysis,      │
│  Fast routing,      │   │  long reports,       │
│  lightweight tasks  │   │  complex reasoning   │
└─────────────────────┘   └─────────────────────┘
```

- **Phi-3.5 (local, free)** — handles fast queries, planning, and tool dispatch. Runs on your machine via Ollama. No API cost, no added latency.
- **Claude API (cloud, paid)** — handles deep portfolio analysis, long-form reports, and complex multi-step reasoning. Called only when needed. Hard-capped at $0.07/day in code.

---

## Key Design Decisions

**Two-tier AI routing**

*Problem:* sending every query to Claude would cost money and add 2–4s latency for simple requests. Running everything locally on Phi-3.5 wouldn't handle deep analysis or long reports reliably.

*Alternative:* pick one model — all-local (free but weak on complex tasks) or all-cloud (strong but expensive on every call).

*Choice:* a keyword-based router classifies each query in under a millisecond. Phi-3.5 handles structured lookups and tool dispatch. Claude is reserved for weekly reports, signal generation with full reasoning, and tax analysis. Daily Claude spend stays under $0.07.

---

**No database**

*Problem:* holdings, settings, and cached API responses need to persist across restarts.

*Alternative:* SQLite or a local Postgres instance — better for concurrent access and complex queries, but adds setup steps, schema migrations, and a running process.

*Choice:* JSON flat files. For a personal single-user tool with a few dozen holdings there's no meaningful advantage to a database. Every file is inspectable in a text editor and trivially backed up.

---

**`getHoldings()` as single source of truth**

*Problem:* early on, every service that needed portfolio data held its own stale snapshot of tickers — wrong the moment you updated your holdings.

*Alternative:* pass holdings as a parameter through the call stack, requiring every caller to fetch and forward them.

*Choice:* a zero-argument `getHoldings()` in `backend/config/holdings.js` reads the active account at call time. All backend services call it with no arguments. When multi-account support was added, only `holdings.js` changed — no downstream services needed updating. The same function also transparently handles demo mode: it returns the bundled demo portfolio when demo mode is on and the real account otherwise, so no calling code needs to know which mode it's in.

---

**API cost discipline**

*Problem:* Claude API has no built-in guardrail that prevents overspend within a single day.

*Alternative:* rely on the Anthropic workspace monthly cap alone.

*Choice:* three layers — a code-level daily hard cap ($0.07) checked before every API call, a monthly workspace cap ($3 set in the Anthropic console), and auto-recharge disabled. Overspend is structurally impossible regardless of bugs or runaway loops.

---

**Prompt caching**

*Problem:* the system prompt and portfolio context are ~2,000 tokens and identical across every Claude call in a session.

*Alternative:* send the full context fresh on every request.

*Choice:* Anthropic's prompt caching marks these blocks as cacheable. Follow-up calls in the same cache window skip retransmitting them — roughly 90% token cost reduction on repeat queries.

---

## Requirements

- **Node.js** v18 or later ([nodejs.org](https://nodejs.org))
- **Ollama** ([ollama.com](https://ollama.com)) with Phi-3.5 pulled (`ollama pull phi3.5`) — required for the local agent brain, only if you want the AI features
- Your own API keys, if you want live data and AI features (the repo runs fully on demo data with none of these):
  - [Anthropic](https://console.anthropic.com) — AI analysis and report generation
  - [Alpha Vantage](https://www.alphavantage.co) — stock/ETF prices (25 calls/day free)
  - [CoinGecko](https://www.coingecko.com/en/api) — crypto prices (20 calls/day free)
  - [NewsAPI](https://newsapi.org) — news headlines (100 calls/day free)

This project doesn't include, proxy, or share any API keys — every user connects their own via `.env`. Nothing here calls out to a shared backend of mine.

---

## Installation

> **Note:** the clone URL below uses a placeholder repository name — update it once the repo is published.

```bash
# 1. Clone the repository
git clone https://github.com/EliasNymander/investing-agent-demo.git
cd investing-agent-demo

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# 3. Copy the env template (lives in the project root)
cp .env.example .env
# Open .env and fill in your own API keys — or leave it as-is to run on demo data

# 4. (Optional) Pull the local AI model — only needed for the local agent brain
ollama pull phi3.5
```

**Terminal 1 — backend:**
```bash
cd backend && npm start
```

**Terminal 2 — frontend:**
```bash
cd frontend && npm run dev
```

Then open **http://localhost:5173** in your browser. Demo mode is on by default, so you'll see a fully populated dashboard immediately.

To enter your own portfolio instead: open **Settings** and disable demo mode, then use the **Setup Wizard** to add your real holdings.

---

## Entering Your Own Portfolio

Once you're past the bundled demo data, the Setup Wizard asks for your holdings per platform:

| Platform type | Asset Type | Notes |
|---|---|---|
| Brokerage (e.g. Nordnet) | Stocks & ETFs | Enter ticker, name, quantity, average cost |
| Fund platform (e.g. Nordea) | Investment Funds | Manual NAV entry (no public API available for most Nordic fund platforms) |
| Crypto exchange | Crypto | Ticker matches CoinGecko IDs (e.g. BTC, ADA, DOT) |

You can re-enter the wizard anytime from the **Settings** page.

---

## Configuration

User data is split across two gitignored locations:

### `.env`
Copy from `.env.example`. Controls API keys and mock mode:
```
USE_CLAUDE_MOCK=true        # Set to false to enable live AI analysis
ANTHROPIC_API_KEY=...
ALPHA_VANTAGE_API_KEY=...
COINGECKO_API_KEY=...
NEWS_API_KEY=...
```

### `backend/data/accounts/`
Created automatically when the app first runs (or when you exit demo mode). Stores account metadata and your real holdings per account. Gitignored — never committed, and structurally separate from the demo data shipped in `backend/data/mock-*.js`.

---

## Report Schedules

Configure in Setup Wizard Step 3:

- **Daily Alert** — runs at your chosen time (e.g. 08:00 Europe/Helsinki)
- **Weekly Report** — runs every Monday at 07:00 (configurable)

Generated reports are saved to `backend/generated/` as JSON files (gitignored):
- `daily-YYYY-MM-DD.json`
- `weekly-YYYY-WW.json`

To trigger a report manually:
```bash
curl -X POST "http://localhost:3001/api/scheduler/trigger?type=daily"
curl -X POST "http://localhost:3001/api/scheduler/trigger?type=weekly"
```

---

## Project Structure

```
investing-agent/
├── agent-core/
│   ├── local/        # Phi-3.5 agent brain (Ollama) — agent.js, router.js, tools.js, ollamaClient.js
│   └── cloud/        # Claude API escalation client
├── backend/          # Express API server (port 3001)
│   ├── config/       # Account and demo-mode state
│   ├── data/         # Demo/mock data, account JSON files (gitignored)
│   ├── routes/       # REST API endpoints (21 routes)
│   ├── services/     # Data fetching, scheduling, AI orchestration (23 services)
│   ├── utils/        # Shared helpers (currency, markdown, flag calculator)
│   ├── cache/        # Auto-generated JSON cache files (gitignored)
│   └── generated/    # Daily and weekly briefing outputs (gitignored)
├── frontend/         # React + Vite (port 5173)
│   └── src/
│       ├── api/      # Fetch helpers for each backend route
│       ├── components/
│       ├── context/
│       ├── hooks/    # SWR data hooks
│       ├── pages/    # One file per page
│       └── utils/
└── .env.example      # Environment variable template
```

---

## Nordic Market Notes

The agent is built with Finnish/Nordic portfolios in mind:
- EUR is the base currency for all portfolio aggregation
- EUR/USD, EUR/SEK, and EUR/DKK rates fetched daily
- ECB and Riksbank policy events tracked as macro impact signals
- Manual fund NAV entry, since most Nordic fund platforms have no public API

---

## Roadmap

- [x] Live portfolio dashboard with real prices
- [x] Multi-account support
- [x] AI agent chat with portfolio context
- [x] Buy/sell signals
- [x] Daily alerts and weekly reports
- [x] Intelligence feed (news + watchlist)
- [x] Tax summary (manual entry)
- [x] Live FX rates
- [x] Public demo mode with bundled sample portfolio
- [ ] Tax Phase 2 — CSV import
- [ ] Mobile responsiveness
- [ ] Alpha Vantage quota monitoring dashboard
- [ ] Paper trading simulation

---

## What I Learned / What I'd Do Differently

**Mock engine grew larger than expected.** The bundled demo data (fake portfolio, prices, signals, news, tax scenario) now runs to roughly 850 lines across nine files. It made early UI iteration fast, but it accumulated dead code that needed cleaning up once real APIs were wired in. Next time: a thin stub layer only — one function returning a fixed JSON shape, no mock portfolio state to maintain.

**`getHoldings()` abstraction was worth doing early.** Making every service use a zero-argument getter rather than accepting holdings as a parameter meant that adding multi-account support — and later, demo mode — touched exactly one file. Worth setting up this kind of single-source-of-truth contract before you think you need it.

**Yahoo Finance is fragile.** The ISIN-to-ticker lookup relies on an undocumented chart endpoint that returns data without auth — it works today but could break without notice. A more robust path would be scraping NAV from official fund provider pages or using a dedicated fund data API.

**The keyword router works but doesn't scale.** 39 hardcoded phrases cover the common cases well. Expanding to new asset classes or a second language would mean manually adding phrases. An embedding-based classifier would handle novel queries more naturally — worth revisiting if the agent is extended beyond the original portfolio.

---

## CoinGecko Attribution

Crypto price data is provided by **[CoinGecko](https://www.coingecko.com)**. The free tier requires displaying "Price data by CoinGecko" with a link near all crypto data. This attribution is rendered automatically in the dashboard.

---

## Support

File issues or feedback at the project repository.
