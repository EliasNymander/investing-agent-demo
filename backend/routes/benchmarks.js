import { Router } from 'express';
import { getBenchmarkComparison } from '../services/benchmarks-service.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const period = req.query.period ?? '1Y';
    const data = await getBenchmarkComparison(period);
    res.json({ status: 'ok', data });
  } catch (err) {
    console.error('benchmarks error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
