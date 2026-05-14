import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAdminTenantAuth } from '@/context/AdminTenantAuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { CreditCard, ExternalLink } from 'lucide-react';

interface BillingStatus {
  status: string;
  planId: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  invoiceUrl: string | null;
}

export default function BillingPage() {
  const { isAuthenticated, loading: authLoading } = useAdminTenantAuth();
  const [, setLocation] = useLocation();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: invoiceData, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ['/api/billing/invoices'],
    queryFn: async () => {
      const res = await fetch('/api/billing/invoices', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load invoices');
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });
  const invoices = invoiceData?.invoices ?? [];

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/admin/login');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Fetch billing status
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/billing/status', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load billing status');
        return res.json();
      })
      .then((data: BillingStatus) => {
        setBillingStatus(data);
        setFetchLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setFetchLoading(false);
      });
  }, [isAuthenticated]);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Failed to open billing portal');
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPortalLoading(false);
    }
  };

  const statusBadgeClass = (status: string) => {
    if (status === 'active' || status === 'trialing') return 'bg-green-100 text-green-800';
    if (status === 'past_due') return 'bg-yellow-100 text-yellow-800';
    if (status === 'canceled') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-600';
  };

  const daysRemaining = billingStatus?.currentPeriodEnd
    ? Math.max(0, Math.ceil(
        (new Date(billingStatus.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : null;

  if (authLoading || fetchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <CreditCard className="w-6 h-6" />
          Billing
        </h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and payment details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Status</CardTitle>
          <CardDescription>Your current plan and billing information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {billingStatus && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-32">Status</span>
                <Badge className={statusBadgeClass(billingStatus.status)}>
                  {billingStatus.status}
                </Badge>
                {billingStatus.status === 'trialing' && (
                  <Badge className="bg-blue-100 text-blue-800">Trial</Badge>
                )}
              </div>

              {billingStatus.status === 'trialing' && daysRemaining !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-32">Trial ends</span>
                  <span className="text-sm text-foreground font-medium">
                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                  </span>
                </div>
              )}

              {billingStatus.planId && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-32">Plan ID</span>
                  <span className="text-sm font-mono text-foreground">{billingStatus.planId}</span>
                </div>
              )}

              {billingStatus.currentPeriodEnd && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-32">Renews</span>
                  <span className="text-sm text-foreground">
                    {new Date(billingStatus.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            {(billingStatus?.status === 'trialing' || billingStatus?.status === 'past_due') && (
              <Button
                onClick={handleManageBilling}
                disabled={portalLoading || !billingStatus.stripeCustomerId}
                className="gap-2 mr-2 rounded-full bg-[#FFFF01] text-black font-bold hover:bg-yellow-300"
              >
                <ExternalLink className="w-4 h-4" />
                {portalLoading ? 'Opening portal...' : 'Add Payment Method'}
              </Button>
            )}
            <Button
              onClick={handleManageBilling}
              disabled={portalLoading || !billingStatus?.stripeCustomerId}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              {portalLoading ? 'Opening portal...' : 'Manage Billing'}
            </Button>
            {!billingStatus?.stripeCustomerId && (
              <p className="text-xs text-muted-foreground mt-2">
                No billing account found. Contact support.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {(inv.amount / 100).toFixed(2)} {inv.currency.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <Badge className={inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.invoiceUrl ? (
                        <a
                          href={inv.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Download
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
