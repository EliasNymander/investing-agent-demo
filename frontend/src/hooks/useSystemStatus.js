import useSWR from 'swr';

async function fetchSystemStatus() {
  const r = await fetch('/api/system/status');
  if (!r.ok) throw new Error(`System status API error: ${r.status}`);
  const json = await r.json();
  return json.data;
}

export function useSystemStatus() {
  const { data, error, isLoading } = useSWR('/api/system/status', fetchSystemStatus, { refreshInterval: 300000 });
  return { status: data, isLoading, error };
}
