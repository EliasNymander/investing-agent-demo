import { Router } from 'express';
import {
  getPriceAlerts, addPriceAlert, updatePriceAlert, deletePriceAlert,
} from '../services/price-alert-service.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    res.json({ status: 'ok', data: getPriceAlerts() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    res.json({ status: 'ok', data: addPriceAlert(req.body) });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const item = updatePriceAlert(req.params.id, req.body);
    if (!item) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'ok', data: item });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    deletePriceAlert(req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
