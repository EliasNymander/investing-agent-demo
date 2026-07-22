import useSWR from 'swr';
import { demoFetch } from '../api/demoFetch.js';

async function fetchWeeklyReport() {
  const res = await demoFetch('/api/scheduler/latest?type=weekly');
  if (res.status === 404) return { notGenerated: true };
  if (!res.ok) throw new Error('Failed to load weekly report');
  const json = await res.json();
  return json.data;
}

export function useReports() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/scheduler/latest?type=weekly',
    fetchWeeklyReport,
    { refreshInterval: 300000 }
  );
  return { report: data, isLoading, error, mutate };
}
