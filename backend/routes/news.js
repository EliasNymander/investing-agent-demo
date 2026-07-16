import { Router } from 'express';
import { getNewsFeed } from '../services/news-service.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { ticker, category } = req.query;
    const data = getNewsFeed({ ticker, category });
    res.json({ status: 'ok', data });
  } catch (err) {
    console.error('news error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
