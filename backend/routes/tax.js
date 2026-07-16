import { Router } from 'express';
import { getTaxData } from '../services/tax-service.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const year = parseInt(req.query.year) || 2026;
    const data = getTaxData(year);
    if (data.error) return res.status(404).json({ status: 'error', message: data.error });
    res.json({ status: 'ok', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
