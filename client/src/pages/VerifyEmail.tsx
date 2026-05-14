import { Link } from 'wouter';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Mail, ArrowLeft } from 'lucide-react';

export default function VerifyEmail() {
  const { toast } = useToast();
  const [resending, setResending] = useState(false);

  // Parse query params from window.location.search
  const searchParams = new URLSearchParams(window.location.search);
  const error = searchParams.get('error');

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Verification email sent', description: 'Check your inbox for a new verification link.' });
      } else if (res.status === 401) {
        toast({
          title: 'Please log in first',
          description: 'You need to be logged in to resend a verification email.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Email sent', description: 'If your session is active, check your inbox.' });
      }
    } catch {
      toast({ title: 'Email sent', description: 'If your session is active, check your inbox.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <Link href="/admin/login">
          <Button variant="ghost" className="mb-4 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </Link>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="space-y-3 text-center pb-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-red-50 rounded-md flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Verification link invalid</CardTitle>
            <CardDescription>
              {error === 'invalid'
                ? 'This verification link has expired or has already been used. Request a new one below.'
                : 'There was a problem with your verification link. Request a new one below.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-center">
            <Button
              onClick={handleResend}
              disabled={resending}
              className="w-full"
            >
              <Mail className="w-4 h-4 mr-2" />
              {resending ? 'Sending...' : 'Resend verification email'}
            </Button>
            <p className="text-sm text-slate-500">
              Already verified?{' '}
              <Link href="/admin/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
