import { Router } from 'express';
import { getDailyAlert } from '../services/alert-service.js';

const router = Router();

router.get('/daily', async (_req, res) => {
  try {
    const data = await getDailyAlert();
    res.json({ status: 'ok', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
