import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { config } from '../config.js';

const router = Router();

router.get('/', (_req, res) => {
  if (!existsSync(config.userConfigPath)) {
    return res.json({ status: 'ok', data: { setupComplete: false } });
  }
  try {
    const userConfig = JSON.parse(readFileSync(config.userConfigPath, 'utf8'));
    res.json({ status: 'ok', data: userConfig });
  } catch {
    res.json({ status: 'ok', data: { setupComplete: false } });
  }
});

router.post('/', (req, res) => {
  try {
    const payload = { ...req.body, setupComplete: true };
    writeFileSync(config.userConfigPath, JSON.stringify(payload, null, 2), 'utf8');
    res.json({ status: 'ok', data: payload });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
