import { Router } from 'express';
import { getAnalytics } from '../services/analytics-service.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const data = await getAnalytics();
    res.json({ status: 'ok', data });
  } catch (err) {
    console.error('analytics error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
