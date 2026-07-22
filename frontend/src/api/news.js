import { demoFetch } from './demoFetch.js';

export function fetchNewsFeed({ ticker, category } = {}) {
  const params = new URLSearchParams();
  if (ticker && ticker !== 'all') params.set('ticker', ticker);
  if (category && category !== 'all') params.set('category', category);
  const qs = params.toString();
  return demoFetch(`/api/news${qs ? `?${qs}` : ''}`).then((r) => r.json()).then((r) => r.data);
}
