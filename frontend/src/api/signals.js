export const fetchSignals = (type) =>
  fetch(`/api/signals${type ? `?type=${type}` : ''}`)
    .then((r) => { if (!r.ok) throw new Error(`Signals API error: ${r.status}`); return r.json(); })
    .then((r) => r.data);
