import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/context/AuthContext';
import { useCompanySettings } from '@/context/CompanySettingsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Lock, Mail, ArrowLeft } from 'lucide-react';

type AuthMeResponse = {
  role: 'admin' | 'user' | 'staff' | 'client';
};

const AUTH_ME_RETRY_DELAYS_MS = [0, 400, 1000];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchRoleForSession(accessToken: string) {
  let shouldClearLocalSession = false;

  for (const delay of AUTH_ME_RETRY_DELAYS_MS) {
    if (delay > 0) {
      await wait(delay);
    }

    const meRes = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });

    if (meRes.ok) {
      return meRes.json() as Promise<AuthMeResponse>;
    }

    if (meRes.status === 401 || meRes.status === 403) {
      shouldClearLocalSession = true;
      continue;
    }

    shouldClearLocalSession = false;
  }

  if (shouldClearLocalSession) {
    const {
      data: { session: freshSession },
    } = await supabase.auth.getSession();

    const hasSameToken =
      !freshSession?.access_token || freshSession.access_token === accessToken;

    if (hasSameToken) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }

    throw new Error('Session validation failed. Please try again.');
  }

  throw new Error('Unable to validate the session right now. Please try again.');
}

export default function ClientLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isClient, loading: authLoading } = useAdminAuth();
  const { settings: companySettings } = useCompanySettings();

  useEffect(() => {
    if (!authLoading && isClient) {
      setLocation('/account');
    }
  }, [isClient, authLoading, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error('Session was not created. Please try again.');
      }

      const me = await fetchRoleForSession(accessToken);

      if (me.role === 'client') {
        setLocation('/account');
      } else {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        toast({
          title: 'Wrong account type',
          description: 'This login is for customer accounts only.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <Link href="/">
          <Button variant="ghost" className="mb-4 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="space-y-3 text-center pb-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center overflow-hidden">
                <img
                  src="/favicon.png"
                  alt="Logo"
                  className="w-12 h-12 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <Lock className="w-6 h-6 text-primary hidden" />
              </div>
            </div>

            <CardTitle className="text-2xl font-bold">
              {companySettings?.companyName || 'My Account'}
            </CardTitle>
            <CardDescription>Sign in to manage your bookings</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
