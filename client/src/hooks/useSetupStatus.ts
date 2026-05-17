import { useQuery } from '@tanstack/react-query';

export interface SetupStatus {
  hasService: boolean;
  hasStaff: boolean;
  hasAvailability: boolean;
  dismissed: boolean;
}

export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: ['/api/admin/setup-status'],
    queryFn: () =>
      fetch('/api/admin/setup-status', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch setup status');
        return r.json();
      }),
    staleTime: 10_000, // 10 seconds — live enough without hammering the server
  });
}
