const BASE = '/api/accounts';
import { demoFetch } from './demoFetch.js';

const json = (r) => { if (!r.ok) throw new Error(`Accounts API error: ${r.status}`); return r.json(); };

export const fetchAccounts = () =>
  demoFetch(BASE).then(json).then((r) => r.data);

export const fetchActiveAccount = () =>
  demoFetch(`${BASE}/active`).then(json).then((r) => r.data);

export const createAccountApi = (name, description = '', color = '#4CAF50') =>
  fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, color }) })
    .then(json).then((r) => r.data);

export const deleteAccountApi = (id) =>
  fetch(`${BASE}/${id}`, { method: 'DELETE' }).then(json).then((r) => r.data);

export const switchAccountApi = (id) =>
  fetch(`${BASE}/${id}/switch`, { method: 'POST' }).then(json).then((r) => r.data);

export const renameAccountApi = (id, name, description, color) =>
  fetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, color }) })
    .then(json).then((r) => r.data);

export const getTrackedAssetsApi = (id) =>
  demoFetch(`${BASE}/${id}/tracked-assets`).then(json).then((r) => r.data);

export const saveTrackedAssetsApi = (id, tickers) =>
  fetch(`${BASE}/${id}/tracked-assets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers }),
  }).then(json).then((r) => r.data);
