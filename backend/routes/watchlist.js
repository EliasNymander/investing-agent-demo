import { Router } from 'express';
import {
  getWatchlist, addToWatchlist, updateWatchlistItem,
  removeFromWatchlist, addAlert, removeAlert,
} from '../services/watchlist-service.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const data = await getWatchlist();
    const triggeredCount = data.filter((i) => i.hasTriggeredAlerts).length;
    res.json({ status: 'ok', data, triggeredCount });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const item = await addToWatchlist(req.body);
    res.json({ status: 'ok', data: item });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const item = await updateWatchlistItem(req.params.id, req.body);
    if (!item) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'ok', data: item });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    removeFromWatchlist(req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/:id/alerts', async (req, res) => {
  try {
    const item = await addAlert(req.params.id, req.body);
    if (!item) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'ok', data: item });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id/alerts/:alertId', async (req, res) => {
  try {
    const item = await removeAlert(req.params.id, req.params.alertId);
    if (!item) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'ok', data: item });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
