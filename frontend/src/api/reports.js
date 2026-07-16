export const fetchReports = () => fetch('/api/reports/weekly').then((r) => r.json()).then((r) => r.data);
