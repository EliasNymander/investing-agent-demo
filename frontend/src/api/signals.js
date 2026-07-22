import { demoFetch } from './demoFetch.js';

export const fetchSignals = (type) =>
  demoFetch(`/api/signals${type ? `?type=${type}` : ''}`)
    .then((r) => { if (!r.ok) throw new Error(`Signals API error: ${r.status}`); return r.json(); })
    .then((r) => r.data);
