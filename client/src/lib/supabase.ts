import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

function shouldDetectSupabaseSession(url: URL, params: { [parameter: string]: string }) {
  const isCalendarState = typeof params.state === 'string' && /^\d+:(admin|staff)$/.test(params.state);
  if (isCalendarState || url.pathname.startsWith('/api/staff/calendar/callback')) {
    return false;
  }

  const hasHashSession = Boolean(params.access_token || params.refresh_token || params.expires_in);
  if (hasHashSession) {
    return true;
  }

  const hasPkceCode = Boolean(params.code);
  const isAllowedAuthPath =
    url.pathname === '/' ||
    url.pathname === '/admin' ||
    url.pathname === '/admin/' ||
    url.pathname === '/admin/login';

  return hasPkceCode && isAllowedAuthPath;
}

if (!supabaseUrl || !supabasePublicKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: shouldDetectSupabaseSession
  }
});
