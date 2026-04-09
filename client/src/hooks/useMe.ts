import { useQuery } from '@tanstack/react-query';
import { useAdminAuth } from '@/context/AuthContext';

interface MeData {
  id: string;
  email: string;
  role: 'admin' | 'staff' | 'viewer';
  staffMemberId: number | null;
}

export function useMe() {
  const { getAccessToken } = useAdminAuth();

  const { data } = useQuery<MeData>({
    queryKey: ['/api/me'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch user profile');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min — role doesn't change often
  });

  return {
    role: data?.role ?? 'admin', // default admin while loading (prevents flicker for existing users)
    staffMemberId: data?.staffMemberId ?? null,
    isAdmin: !data || data.role === 'admin',
    isStaff: data?.role === 'staff',
  };
}
