import express from 'express';
import { getStatus } from '../services/claude-budget-service.js';

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json({ success: true, data: getStatus() });
});

export default router;
