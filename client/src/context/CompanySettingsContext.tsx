import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CompanySettings } from '@shared/schema';

interface CompanySettingsContextValue {
  settings: CompanySettings | null;
  isLoading: boolean;
  isReady: boolean;
}

const CompanySettingsContext = createContext<CompanySettingsContextValue>({
  settings: null,
  isLoading: true,
  isReady: false,
});

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading, isFetched } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
    // Uses global staleTime (5 min) from queryClient.ts
  });

  const value: CompanySettingsContextValue = {
    settings: settings ?? null,
    isLoading,
    isReady: isFetched,
  };

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export function useCompanySettings(): CompanySettingsContextValue {
  return useContext(CompanySettingsContext);
}
