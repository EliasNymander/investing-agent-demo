import { demoFetch } from './demoFetch.js';

export const fetchIntelligenceFeed = () =>
  demoFetch('/api/intelligence').then((r) => r.json()).then((r) => r.data);
