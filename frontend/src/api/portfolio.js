export const fetchPortfolio = () =>
  fetch('/api/portfolio')
    .then((r) => { if (!r.ok) throw new Error(`Portfolio API error: ${r.status}`); return r.json(); })
    .then((r) => r.data);
