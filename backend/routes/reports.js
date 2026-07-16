import { Router } from 'express';
import { getWeeklyReport } from '../services/report-service.js';

const router = Router();

router.get('/weekly', async (_req, res) => {
  try {
    const data = await getWeeklyReport();
    res.json({ status: 'ok', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
