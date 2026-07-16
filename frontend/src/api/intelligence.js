export const fetchIntelligenceFeed = () =>
  fetch('/api/intelligence').then((r) => r.json()).then((r) => r.data);
