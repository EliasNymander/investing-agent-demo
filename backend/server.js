import express from 'express';
import cors from 'cors';
import { config } from './config.js';

import portfolioRouter from './routes/portfolio.js';
import alertsRouter from './routes/alerts.js';
import reportsRouter from './routes/reports.js';
import signalsRouter from './routes/signals.js';
import configRouter from './routes/config-api.js';
import schedulerRouter from './routes/scheduler.js';
import historyRouter from './routes/history.js';
import watchlistRouter from './routes/watchlist.js';
import analyticsRouter from './routes/analytics.js';
import benchmarksRouter from './routes/benchmarks.js';
import newsRouter from './routes/news.js';
import journalRouter from './routes/journal.js';
import intelligenceRouter from './routes/intelligence.js';
import taxRouter from './routes/tax.js';
import priceAlertsRouter from './routes/price-alerts.js';
import agentRouter from './routes/agent.js';
import budgetRouter from './routes/budget.js';
import holdingsRouter from './routes/holdings.js';
import demoRouter from './routes/demo.js';
import accountsRouter from './routes/accounts.js';
import systemRouter from './routes/system.js';
import { startScheduler } from './services/scheduler-service.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/portfolio', portfolioRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/config', configRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/history', historyRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/benchmarks', benchmarksRouter);
app.use('/api/news', newsRouter);
app.use('/api/journal', journalRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/tax', taxRouter);
app.use('/api/price-alerts', priceAlertsRouter);
app.use('/api/agent', agentRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/holdings', holdingsRouter);
app.use('/api/demo', demoRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/system', systemRouter);


app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mockMode: config.useMock, timestamp: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`Investing Agent API running on http://localhost:${config.port}`);
  console.log(`Mock mode: ${config.useMock ? 'ON' : 'OFF'}`);
  startScheduler();
});
