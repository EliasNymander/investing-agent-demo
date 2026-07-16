import useSWR from 'swr';
import { fetchPortfolio } from '../api/portfolio.js';

export function usePortfolio() {
  const { data, error, isLoading, mutate } = useSWR('/api/portfolio', fetchPortfolio, { refreshInterval: 30000 });
  return { portfolio: data, isLoading, error, mutate };
}
