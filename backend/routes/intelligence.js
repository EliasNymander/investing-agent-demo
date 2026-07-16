import { Router } from 'express';
import { getIntelligenceFeed } from '../services/intelligence-service.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const data = await getIntelligenceFeed();
    res.json({ status: 'ok', data });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

export default router;
