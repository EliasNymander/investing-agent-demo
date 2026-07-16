import { Router } from 'express';
import { isDemoMode, setDemoMode } from '../config/demo-mode.js';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ isDemoMode: isDemoMode() });
});

router.post('/enable', (_req, res) => {
  setDemoMode(true);
  res.json({ isDemoMode: true });
});

router.post('/disable', (_req, res) => {
  setDemoMode(false);
  res.json({ isDemoMode: false });
});

export default router;
