import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch role from DB when user changes
  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;

        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRole(data.role as UserRole);
        }
      } catch {
        // Silently fail — role stays null
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Extract user metadata
  const email = user?.email ?? null;
  const firstName = user?.user_metadata?.first_name ?? user?.user_metadata?.full_name?.split(' ')[0] ?? null;
  const lastName = user?.user_metadata?.last_name ?? user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') ?? null;

  // Role-based flags
  const isAdmin = role === 'admin';
  const isUser = role === 'user';
  const isStaff = role === 'staff';

  return (
    <AuthContext.Provider value={{
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
      getAccessToken
    }}>
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
