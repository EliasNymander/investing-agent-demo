export const fetchBudgetStatus = () =>
  fetch('/api/budget/status').then((r) => r.json()).then((r) => r.data);
