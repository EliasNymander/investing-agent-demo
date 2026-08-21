import { demoFetch } from './demoFetch.js';

const BASE = '/api/price-alerts';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const fetchPriceAlerts = () =>
  demoFetch(BASE).then((r) => r.json()).then((r) => r.data);

export const addPriceAlert = (data) =>
  fetch(BASE, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) })
    .then((r) => r.json()).then((r) => r.data);

export const updatePriceAlert = (id, patch) =>
  fetch(`${BASE}/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(patch) })
    .then((r) => r.json()).then((r) => r.data);

export const deletePriceAlert = (id) =>
  fetch(`${BASE}/${id}`, { method: 'DELETE' }).then((r) => r.json());
