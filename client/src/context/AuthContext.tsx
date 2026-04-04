import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

type UserRole = 'admin' | 'user' | 'staff';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAdmin: boolean;
  isUser: boolean;
  isStaff: boolean;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  loading: boolean;
  showLoginDialog: boolean;
  setShowLoginDialog: (show: boolean) => void;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_FETCH_RETRY_DELAYS_MS = [0, 400, 1000];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session ?? null);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session ?? null);
      setUser(session?.user ?? null);

      if (!session?.user) {
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !session?.access_token) {
      setRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setRole(null);
      setLoading(true);

      try {
        for (let attempt = 0; attempt < ROLE_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
          const delay = ROLE_FETCH_RETRY_DELAYS_MS[attempt];
          if (delay > 0) {
            await wait(delay);
          }

          if (cancelled) return;

          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            signal: AbortSignal.timeout(8000),
          });

          if (res.ok) {
            if (cancelled) return;
            const data = await res.json();
            setRole(data.role as UserRole);
            return;
          }

          if (res.status === 401 || res.status === 403) {
            if (cancelled) return;

            // Clear rotated or stale local sessions so the next login starts clean.
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            setSession(null);
            setUser(null);
            setRole(null);
            return;
          }
        }
      } catch {
        // Keep the current state quiet; network retries will happen on next auth change.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
  };

  const getAccessToken = async () => {
    if (session?.access_token) {
      return session.access_token;
    }

    const {
      data: { session: freshSession },
    } = await supabase.auth.getSession();

    if (freshSession?.access_token) {
      setSession(freshSession);
      setUser(freshSession.user ?? null);
      return freshSession.access_token;
    }

    return null;
  };

  const email = user?.email ?? null;
  const firstName = user?.user_metadata?.first_name ?? user?.user_metadata?.full_name?.split(' ')[0] ?? null;
  const lastName = user?.user_metadata?.last_name ?? user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') ?? null;

  const isAdmin = role === 'admin';
  const isUser = role === 'user';
  const isStaff = role === 'staff';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isUser,
        isStaff,
        email,
        firstName,
        lastName,
        loading,
        showLoginDialog,
        setShowLoginDialog,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AuthProvider');
  }
  return context;
}
