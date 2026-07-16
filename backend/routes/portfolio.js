import { Router } from 'express';
import { getPortfolio } from '../services/portfolio-service.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const data = await getPortfolio();
    res.json({ status: 'ok', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
