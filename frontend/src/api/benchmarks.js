export const fetchBenchmarks = (period) =>
  fetch(`/api/benchmarks?period=${period}`).then((r) => r.json()).then((r) => r.data);
