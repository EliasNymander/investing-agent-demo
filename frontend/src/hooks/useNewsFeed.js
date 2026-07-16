import useSWR from 'swr';
import { fetchNewsFeed } from '../api/news.js';

export function useNewsFeed(ticker, category) {
  const key = `/api/news?ticker=${ticker ?? 'all'}&category=${category ?? 'all'}`;
  const { data, error, isLoading } = useSWR(
    key,
    () => fetchNewsFeed({ ticker, category }),
    { refreshInterval: 60000 }
  );
  return { feed: data, isLoading, error };
}
