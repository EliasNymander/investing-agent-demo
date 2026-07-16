import useSWR from 'swr';
import { fetchIntelligenceFeed } from '../api/intelligence.js';

export function useIntelligence() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/intelligence',
    fetchIntelligenceFeed,
    { refreshInterval: 120000 }
  );
  return {
    articles:         data?.articles         ?? [],
    sentimentStats:   data?.sentimentStats   ?? null,
    weeklyDigest:     data?.weeklyDigest     ?? null,
    cryptoPrices:     data?.cryptoPrices     ?? {},
    watchlistTickers: data?.watchlistTickers ?? [],
    trackedAssets:    data?.trackedAssets    ?? [],
    holdingNames:     data?.holdingNames     ?? {},
    isLoading,
    error,
    mutate,
  };
}
