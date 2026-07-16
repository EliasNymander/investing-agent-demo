import { Router } from 'express';
import { getJournal, addEntry, updateEntry, deleteEntry } from '../services/journal-service.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    res.json({ status: 'ok', data: getJournal() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const entry = addEntry(req.body);
    res.json({ status: 'ok', data: entry });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const entry = updateEntry(req.params.id, req.body);
    if (!entry) return res.status(404).json({ status: 'error', message: 'Entry not found' });
    res.json({ status: 'ok', data: entry });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    deleteEntry(req.params.id);
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

export default router;
