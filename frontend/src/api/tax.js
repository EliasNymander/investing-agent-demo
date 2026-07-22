const BASE = '/api/tax';
import { demoFetch } from './demoFetch.js';

export const fetchTax = (year) =>
  demoFetch(`${BASE}?year=${year}`)
    .then((r) => { if (!r.ok) throw new Error(`Tax API error: ${r.status}`); return r.json(); })
    .then((r) => r.data);
