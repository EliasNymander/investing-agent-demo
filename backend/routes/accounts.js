// backend/routes/accounts.js

import { Router } from 'express';
import {
  getAccounts, getActiveAccount, getHoldings,
  createAccount, deleteAccount, switchAccount, renameAccount,
  getTrackedAssets, saveTrackedAssets,
} from '../config/holdings.js';

const router = Router();

// GET /api/accounts — full index
router.get('/', (_req, res) => {
  res.json({ status: 'ok', data: getAccounts().accounts });
});

// GET /api/accounts/active — metadata + holdings for active account
// Must be defined before /:id to avoid 'active' being swallowed as a param
router.get('/active', (_req, res) => {
  const account = getActiveAccount();
  if (!account) return res.status(404).json({ status: 'error', error: 'No active account found' });
  res.json({ status: 'ok', data: { ...account, holdings: getHoldings() } });
});

// POST /api/accounts — create new account
router.post('/', (req, res) => {
  const { name, description = '', color = '#4CAF50' } = req.body ?? {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ status: 'error', error: 'name is required' });
  }
  const account = createAccount(name, description, color);
  res.status(201).json({ status: 'ok', data: account });
});

// DELETE /api/accounts/:id
router.delete('/:id', (req, res) => {
  const result = deleteAccount(req.params.id);
  if (!result.success) return res.status(400).json({ status: 'error', error: result.error });
  res.json({ status: 'ok', data: result });
});

// POST /api/accounts/:id/switch
router.post('/:id/switch', (req, res) => {
  const result = switchAccount(req.params.id);
  if (!result.success) return res.status(404).json({ status: 'error', error: result.error });
  res.json({ status: 'ok', data: result });
});

// GET /api/accounts/:id/tracked-assets
router.get('/:id/tracked-assets', (req, res) => {
  const tickers = getTrackedAssets(req.params.id);
  res.json({ status: 'ok', data: { tickers } });
});

// PUT /api/accounts/:id/tracked-assets
router.put('/:id/tracked-assets', (req, res) => {
  const { tickers } = req.body ?? {};
  if (!Array.isArray(tickers))
    return res.status(400).json({ status: 'error', error: 'tickers must be an array' });
  const saved = saveTrackedAssets(tickers, req.params.id);
  res.json({ status: 'ok', data: { tickers: saved } });
});

// PUT /api/accounts/:id — rename / recolor
router.put('/:id', (req, res) => {
  const { name, description, color } = req.body ?? {};
  const result = renameAccount(req.params.id, name, description, color);
  if (!result.success) return res.status(404).json({ status: 'error', error: result.error });
  res.json({ status: 'ok', data: result.account });
});

export default router;
