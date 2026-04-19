import { useCallback, useEffect, useState } from 'react';

export function useHashTab(defaultTab: string, validTabs: readonly string[]) {
  const readHash = useCallback(() => {
    if (typeof window === 'undefined') return defaultTab;
    const hash = window.location.hash.replace(/^#/, '');
    return validTabs.includes(hash) ? hash : defaultTab;
  }, [defaultTab, validTabs]);

  const [tab, setTabState] = useState<string>(readHash);

  useEffect(() => {
    const syncFromHash = () => setTabState(readHash());
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [readHash]);

  const setTab = useCallback((next: string) => {
    if (!validTabs.includes(next)) return;
    setTabState(next);
    const { pathname, search } = window.location;
    const newUrl = `${pathname}${search}#${next}`;
    window.history.replaceState(null, '', newUrl);
  }, [validTabs]);

  return [tab, setTab] as const;
}
