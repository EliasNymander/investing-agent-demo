export const fetchTickerHistory = (ticker, period) =>
  fetch(`/api/history/ticker/${ticker}?period=${period}`)
    .then((r) => r.json())
    .then((r) => r.data);

export const fetchPlatformHistory = (platformId, period) =>
  fetch(`/api/history/platform/${platformId}?period=${period}`)
    .then((r) => r.json())
    .then((r) => r.data);
