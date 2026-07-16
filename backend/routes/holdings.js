import { Router } from 'express';
import { getHoldings, saveHoldings } from '../config/holdings.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', data: getHoldings() });
});

router.post('/', (req, res) => {
  const result = saveHoldings(req.body);
  if (!result.success) {
    return res.status(400).json({ status: 'error', success: false, errors: result.errors, warnings: result.warnings });
  }
  res.json({ status: 'ok', success: true, data: getHoldings(), warnings: result.warnings, errors: [] });
});

export default router;
