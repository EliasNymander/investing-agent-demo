import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { triggerJob } from '../services/scheduler-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = resolve(__dirname, '..', 'generated');

const router = Router();

router.post('/trigger', async (req, res) => {
  const { type } = req.query;
  if (!['daily', 'weekly'].includes(type)) {
    return res.status(400).json({ status: 'error', message: 'type must be daily or weekly' });
  }
  try {
    const result = await triggerJob(type);
    res.json({ status: 'ok', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/scheduler/latest?type=daily|weekly
// Returns the most recently generated briefing or report from disk.
router.get('/latest', (req, res) => {
  const { type } = req.query;
  if (!['daily', 'weekly'].includes(type)) {
    return res.status(400).json({ status: 'error', message: 'type must be daily or weekly' });
  }
  const filePath = resolve(GENERATED_DIR, `latest-${type}.json`);
  if (!existsSync(filePath)) {
    return res.status(404).json({
      status: 'error',
      message: `No ${type} data available yet — trigger a job first via POST /api/scheduler/trigger?type=${type}`,
    });
  }
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    res.json({ status: 'ok', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: `Failed to read ${type} data: ${err.message}` });
  }
});

export default router;
