import useSWR from 'swr';
import { fetchPriceAlerts } from '../api/priceAlerts.js';

export function usePriceAlerts() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/price-alerts',
    fetchPriceAlerts,
    { refreshInterval: 30000 }
  );
  return {
    alerts:         data?.alerts         ?? [],
    triggeredCount: data?.triggeredCount ?? 0,
    isLoading,
    error,
    mutate,
  };
}
