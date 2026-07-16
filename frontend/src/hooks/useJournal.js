import useSWR from 'swr';
import { fetchJournal } from '../api/journal.js';

export function useJournal() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/journal',
    fetchJournal,
    { refreshInterval: 60000 }
  );
  return {
    entries: data?.entries ?? [],
    stats: data?.stats ?? null,
    isLoading,
    error,
    mutate,
  };
}
