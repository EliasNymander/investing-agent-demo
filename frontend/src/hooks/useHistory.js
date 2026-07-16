import useSWR from 'swr';
import { fetchTickerHistory, fetchPlatformHistory } from '../api/history.js';

export function useTickerHistory(ticker, period) {
  const { data, error, isLoading } = useSWR(
    ticker ? `/api/history/ticker/${ticker}?period=${period}` : null,
    () => fetchTickerHistory(ticker, period),
    { revalidateOnFocus: false }
  );
  return { history: data, isLoading, error };
}

export function usePlatformHistory(platformId, period) {
  const { data, error, isLoading } = useSWR(
    platformId ? `/api/history/platform/${platformId}?period=${period}` : null,
    () => fetchPlatformHistory(platformId, period),
    { revalidateOnFocus: false }
  );
  return { history: data, isLoading, error };
}
