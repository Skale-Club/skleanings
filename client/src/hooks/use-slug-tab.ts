import { useCallback } from 'react';
import { useLocation } from 'wouter';

export function useSlugTab(basePath: string, defaultTab: string, validTabs: readonly string[]) {
  const [location, setLocation] = useLocation();

  const normalizedBase = basePath.replace(/\/$/, '');
  const after = location.startsWith(normalizedBase)
    ? location.slice(normalizedBase.length).replace(/^\//, '').split('/')[0]
    : '';
  const currentTab = validTabs.includes(after) ? after : defaultTab;

  const setTab = useCallback((next: string) => {
    if (!validTabs.includes(next)) return;
    setLocation(`${normalizedBase}/${next}`);
  }, [normalizedBase, validTabs, setLocation]);

  return [currentTab, setTab] as const;
}
