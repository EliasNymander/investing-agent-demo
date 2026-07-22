import { demoFetch } from './demoFetch.js';

export const fetchHoldings = () =>
  demoFetch('/api/holdings')
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((r) => r.data);

export const saveHoldingsApi = (payload) =>
  fetch('/api/holdings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
