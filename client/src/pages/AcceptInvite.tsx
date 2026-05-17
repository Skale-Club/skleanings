import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type Status = 'loading' | 'invalid' | 'ready' | 'submitting';

interface InviteInfo {
  email: string;
  companyName: string;
  role: 'staff' | 'admin';
}

export default function AcceptInvite() {
  const [status, setStatus] = useState<Status>('loading');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [token, setToken] = useState<string>('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const t = searchParams.get('token');
    if (!t) {
      setStatus('invalid');
      return;
    }
    setToken(t);

    (async () => {
      try {
        const res = await fetch(`/api/auth/validate-invite?token=${encodeURIComponent(t)}`);
        if (!res.ok) {
          setStatus('invalid');
          return;
        }
        const data = await res.json();
        setInvite({
          email: data.email,
          companyName: data.companyName,
          role: data.role,
        });
        setStatus('ready');
      } catch {
        setStatus('invalid');
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, name: name.trim(), password }),
      });

      if (res.status === 201) {
        const { adminUrl } = await res.json();
        window.location.href = adminUrl;
        return;
      }

      if (res.status === 410) {
        setStatus('invalid');
        return;
      }

      let message = 'Could not accept invitation. Please try again.';
      try {
        const data = await res.json();
        if (data?.message) message = data.message;
      } catch {
        // non-JSON response — keep default message
      }
      setErrors({ form: message });
      setStatus('ready');
    } catch {
      setErrors({ form: 'Network error. Please check your connection and try again.' });
      setStatus('ready');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === 'invalid' || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md">
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="space-y-1 text-center pb-4">
              <CardTitle className="text-2xl font-bold">Invitation expired or already used</CardTitle>
              <CardDescription>
                This invitation link is no longer valid. Ask the person who invited you to send a new one.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const submitting = status === 'submitting';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-2xl font-bold">Accept your invitation</CardTitle>
            <CardDescription>
              You're invited to join <strong>{invite.companyName}</strong> as <strong>{invite.role}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email (read-only) */}
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={invite.email}
                  disabled
                />
              </div>

              {/* Name */}
              <div className="space-y-1">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                />
                {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                />
                {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>}
              </div>

              {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#FFFF01] text-black font-bold rounded-full hover:bg-yellow-300"
              >
                {submitting ? 'Accepting...' : 'Accept Invitation'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
