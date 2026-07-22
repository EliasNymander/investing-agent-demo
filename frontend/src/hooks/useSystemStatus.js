import useSWR from 'swr';
import { demoFetch } from '../api/demoFetch.js';

async function fetchSystemStatus() {
  const r = await demoFetch('/api/system/status');
  if (!r.ok) throw new Error(`System status API error: ${r.status}`);
  const json = await r.json();
  return json.data;
}

export function useSystemStatus() {
  const { data, error, isLoading } = useSWR('/api/system/status', fetchSystemStatus, { refreshInterval: 300000 });
  return { status: data, isLoading, error };
}
