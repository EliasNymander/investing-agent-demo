import useSWR from 'swr';
import { fetchTax } from '../api/tax.js';

export function useTax(year) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/tax?year=${year}`,
    () => fetchTax(year),
    { refreshInterval: 0 }
  );
  return { data: data ?? null, isLoading, error, mutate };
}
