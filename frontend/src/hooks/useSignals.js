import useSWR from 'swr';
import { fetchSignals } from '../api/signals.js';

export function useSignals(type) {
  const key = type ? `/api/signals?type=${type}` : '/api/signals';
  const { data, error, isLoading } = useSWR(key, () => fetchSignals(type), { refreshInterval: 300000 });
  return { signals: data, isLoading, error };
}
