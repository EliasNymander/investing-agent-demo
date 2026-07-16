export const fetchAnalytics = () =>
  fetch('/api/analytics').then((r) => r.json()).then((r) => r.data);
