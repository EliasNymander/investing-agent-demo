import useSWR from 'swr';
import { demoFetch } from '../api/demoFetch.js';

async function fetchDailyBriefing() {
  const res = await demoFetch('/api/scheduler/latest?type=daily');
  if (res.status === 404) return { notGenerated: true };
  if (!res.ok) throw new Error('Failed to load briefing');
  const json = await res.json();
  return json.data;
}

export function useAlerts() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/scheduler/latest?type=daily',
    fetchDailyBriefing,
    { refreshInterval: 300000 }
  );
  return { alerts: data, isLoading, error, mutate };
}
