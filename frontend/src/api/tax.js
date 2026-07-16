const BASE = '/api/tax';

export const fetchTax = (year) =>
  fetch(`${BASE}?year=${year}`)
    .then((r) => { if (!r.ok) throw new Error(`Tax API error: ${r.status}`); return r.json(); })
    .then((r) => r.data);
