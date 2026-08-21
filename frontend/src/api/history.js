import { demoFetch } from './demoFetch.js';

export const fetchTickerHistory = (ticker, period) =>
  demoFetch(`/api/history/ticker/${ticker}?period=${period}`)
    .then((r) => r.json())
    .then((r) => r.data);

export const fetchPlatformHistory = (platformId, period) =>
  demoFetch(`/api/history/platform/${platformId}?period=${period}`)
    .then((r) => r.json())
    .then((r) => r.data);
