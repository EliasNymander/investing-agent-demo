import { Router } from 'express';
import { getTickerHistory, getPlatformHistory } from '../services/history-service.js';
import { getAllHoldings } from '../config/holdings.js';
import { getWatchlist } from '../services/watchlist-service.js';

const router = Router();

// GET /api/history/ticker/:ticker?period=1D|1W|1M|3M|6M|1Y&assetClass=stock
router.get('/ticker/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const period = req.query.period || '1M';

  try {
    // Find asset class — check holdings first, then watchlist
    const holding = getAllHoldings().find((h) => h.ticker === ticker)
      ?? (await getWatchlist()).find((w) => w.ticker === ticker);

    const assetClass = req.query.assetClass ?? holding?.assetClass ?? 'stock';

    const data = getTickerHistory(ticker, assetClass, period);
    if (!data) return res.status(404).json({ status: 'error', message: 'No history available' });

    res.json({ status: 'ok', ticker, period, data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/history/platform/:platformId?period=1D|1W|1M|3M|6M|1Y
router.get('/platform/:platformId', (req, res) => {
  const { platformId } = req.params;
  const period = req.query.period || '1M';

  const data = getPlatformHistory(platformId, period);
  if (!data) return res.status(404).json({ status: 'error', message: 'Platform not found' });

  res.json({ status: 'ok', platform: platformId, period, data });
});

export default router;
