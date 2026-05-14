import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AdminTenantAuthState {
  isAuthenticated: boolean;
  tenantId: number | null;
  email: string | null;
  role: string | null;
  loading: boolean;
}

interface AdminTenantAuthContextType extends AdminTenantAuthState {
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AdminTenantAuthContext = createContext<AdminTenantAuthContextType | undefined>(undefined);

export function AdminTenantAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminTenantAuthState>({
    isAuthenticated: false,
    tenantId: null,
    email: null,
    role: null,
    loading: true,
  });

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/admin-me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setState({ isAuthenticated: true, tenantId: data.tenantId, email: data.email, role: data.role, loading: false });
      } else {
        setState({ isAuthenticated: false, tenantId: null, email: null, role: null, loading: false });
      }
    } catch {
      setState({ isAuthenticated: false, tenantId: null, email: null, role: null, loading: false });
    }
  };

  useEffect(() => { checkSession(); }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setState({ isAuthenticated: false, tenantId: null, email: null, role: null, loading: false });
  };

  const refetch = async () => {
    setState(prev => ({ ...prev, loading: true }));
    await checkSession();
  };

  return (
    <AdminTenantAuthContext.Provider value={{ ...state, logout, refetch }}>
      {children}
    </AdminTenantAuthContext.Provider>
  );
}

export function useAdminTenantAuth() {
  const context = useContext(AdminTenantAuthContext);
  if (context === undefined) {
    throw new Error('useAdminTenantAuth must be used within an AdminTenantAuthProvider');
  }
  return context;
}
