import { demoFetch } from './demoFetch.js';

export const fetchConfig = () => demoFetch('/api/config').then((r) => r.json()).then((r) => r.data);

export const saveConfig = (payload) =>
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.json()).then((r) => r.data);
