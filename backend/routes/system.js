import { Router } from 'express';
import { getSystemStatus } from '../services/system-status-service.js';

const router = Router();

router.get('/status', (_req, res) => {
  try {
    const data = getSystemStatus();
    res.json({ status: 'ok', data });
  } catch (err) {
    console.error('system status error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
