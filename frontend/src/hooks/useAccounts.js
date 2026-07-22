import useSWR from 'swr';
import { fetchAccounts, fetchActiveAccount, getTrackedAssetsApi } from '../api/accounts.js';
import { demoFetch } from '../api/demoFetch.js';

async function fetchDemoStatus() {
  const r = await demoFetch('/api/demo/status');
  if (!r.ok) throw new Error(`Demo API error: ${r.status}`);
  return r.json();
}

export function useAccounts() {
  const { data, error, isLoading, mutate } = useSWR('/api/accounts', fetchAccounts);
  return { accounts: data ?? [], isLoading, error, mutate };
}

export function useActiveAccount() {
  const { data, error, isLoading, mutate } = useSWR('/api/accounts/active', fetchActiveAccount);
  return { activeAccount: data, isLoading, error, mutate };
}

export function useTrackedAssets() {
  const { activeAccount } = useActiveAccount();
  const id = activeAccount?.id;
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/accounts/${id}/tracked-assets` : null,
    () => getTrackedAssetsApi(id),
  );
  return { trackedAssets: data?.tickers ?? [], isLoading, error, mutate };
}

export function useDemoMode() {
  const { data, error, isLoading, mutate } = useSWR('/api/demo/status', fetchDemoStatus);
  return { isDemoMode: data?.isDemoMode ?? false, isLoading, error, mutate };
}
