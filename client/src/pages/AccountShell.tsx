import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAdminAuth } from '@/context/AuthContext';

export default function AccountShell() {
  const { isClient, loading } = useAdminAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !isClient) {
      setLocation('/admin/login');
    }
  }, [isClient, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isClient) {
    return null;
  }

  return (
    <div className="p-8 text-center">
      Account portal — coming soon
    </div>
  );
}
