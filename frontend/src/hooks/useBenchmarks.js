import useSWR from 'swr';
import { fetchBenchmarks } from '../api/benchmarks.js';

export function useBenchmarks(period) {
  const { data, error, isLoading } = useSWR(
    `/api/benchmarks?period=${period}`,
    () => fetchBenchmarks(period),
    { refreshInterval: 60000 }
  );
  return { benchmarks: data, isLoading, error };
}
