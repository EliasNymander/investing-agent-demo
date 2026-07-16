import { Router } from 'express';
import { getSignals } from '../services/signal-service.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const data = await getSignals(type);
    res.json({ status: 'ok', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
