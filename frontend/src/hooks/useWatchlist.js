import useSWR from 'swr';
import { fetchWatchlist } from '../api/watchlist.js';

export function useWatchlist() {
  const { data, error, isLoading, mutate } = useSWR('/api/watchlist', fetchWatchlist, { refreshInterval: 30000 });
  return {
    items: data?.items ?? [],
    triggeredCount: data?.triggeredCount ?? 0,
    isLoading,
    error,
    mutate,
  };
}
