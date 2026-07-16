import useSWR from 'swr';
import { fetchAnalytics } from '../api/analytics.js';

export function useAnalytics() {
  const { data, error, isLoading } = useSWR('/api/analytics', fetchAnalytics, { refreshInterval: 60000 });
  return { analytics: data, isLoading, error };
}
