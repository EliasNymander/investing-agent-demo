const BASE = '/api/watchlist';
import { demoFetch } from './demoFetch.js';

export const fetchWatchlist = () =>
  demoFetch(BASE).then((r) => r.json()).then((r) => ({ items: r.data, triggeredCount: r.triggeredCount }));

export const addWatchlistItem = (item) =>
  fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
    .then((r) => r.json()).then((r) => r.data);

export const updateWatchlistItem = (id, patch) =>
  fetch(`${BASE}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    .then((r) => r.json()).then((r) => r.data);

export const removeWatchlistItem = (id) =>
  fetch(`${BASE}/${id}`, { method: 'DELETE' }).then((r) => r.json());

export const addAlert = (id, alert) =>
  fetch(`${BASE}/${id}/alerts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alert) })
    .then((r) => r.json()).then((r) => r.data);

export const removeAlert = (id, alertId) =>
  fetch(`${BASE}/${id}/alerts/${alertId}`, { method: 'DELETE' })
    .then((r) => r.json()).then((r) => r.data);
