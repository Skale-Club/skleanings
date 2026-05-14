import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useAdminTenantAuth } from '@/context/AdminTenantAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function Signup() {
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { isAuthenticated, loading: authLoading } = useAdminTenantAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setLocation('/admin');
    }
  }, [isAuthenticated, authLoading, setLocation]);

  const clearFieldError = (field: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!slug.trim()) {
      newErrors.slug = 'Subdomain is required';
    } else if (slug.length < 2 || !/^[a-z0-9-]+$/.test(slug)) {
      newErrors.slug = 'Only lowercase letters, numbers, and hyphens';
    }
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, slug, email, password }),
      });

      if (res.status === 201) {
        const { adminUrl } = await res.json();
        window.location.href = adminUrl;
        return;
      }

      if (res.status === 409 || res.status === 400) {
        const { field, message } = await res.json();
        setErrors({ [field]: message });
        return;
      }

      setErrors({ form: 'Something went wrong. Please try again.' });
    } catch {
      setErrors({ form: 'Network error. Please check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
            <CardDescription>Start your 14-day free trial — no credit card required</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company Name */}
              <div className="space-y-1">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Sparkle Cleaning Co."
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); clearFieldError('companyName'); }}
                />
                {errors.companyName && <p className="text-sm text-destructive mt-1">{errors.companyName}</p>}
              </div>

              {/* Subdomain */}
              <div className="space-y-1">
                <Label htmlFor="slug">Subdomain</Label>
                <div className="flex items-center gap-0">
                  <Input
                    id="slug"
                    type="text"
                    placeholder="my-company"
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value.toLowerCase()); clearFieldError('slug'); }}
                    className="rounded-r-none"
                  />
                  <span className="px-3 py-2 bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground whitespace-nowrap">
                    .xkedule.com
                  </span>
                </div>
                {errors.slug && <p className="text-sm text-destructive mt-1">{errors.slug}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
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
                disabled={loading}
                className="w-full bg-[#FFFF01] text-black font-bold rounded-full hover:bg-yellow-300"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{' '}
              <Link href="/admin/login" className="text-primary hover:underline">Sign in</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
