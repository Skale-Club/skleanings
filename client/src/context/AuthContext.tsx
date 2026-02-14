import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
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
  const [loading, setLoading] = useState(true);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Extract user metadata
  const email = user?.email ?? null;
  const firstName = user?.user_metadata?.first_name ?? user?.user_metadata?.full_name?.split(' ')[0] ?? null;
  const lastName = user?.user_metadata?.last_name ?? user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') ?? null;
  
  // Check if user is admin (you can customize this logic based on your needs)
  // For example, check if email is in an allowed list or check user_metadata.role
  const isAdmin = !!user;

  return (
    <AuthContext.Provider value={{ 
      user,
      isAdmin, 
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
