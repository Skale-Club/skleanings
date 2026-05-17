import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, RefreshCw, Wallet, X } from 'lucide-react';

interface StripeConnectStatus {
  connected: boolean;
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

interface OnboardResponse {
  url: string;
}

async function fetchStatus(): Promise<StripeConnectStatus> {
  const res = await fetch('/api/admin/stripe/status', { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Failed to load Stripe status');
  }
  return res.json();
}

async function postOnboard(): Promise<OnboardResponse> {
  const res = await fetch('/api/admin/stripe/connect/onboard', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Failed to start onboarding');
  }
  return res.json();
}

interface RefreshResult {
  ok: boolean;
  notFound?: boolean;
  message?: string;
}

async function postRefresh(): Promise<RefreshResult> {
  const res = await fetch('/api/admin/stripe/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  if (res.status === 404) {
    return { ok: false, notFound: true };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Failed to refresh Stripe status');
  }
  return { ok: true };
}

interface RecentPayment {
  id: number;
  customerName: string;
  serviceName: string;
  amountTotal: number;
  platformFeeAmount: number | null;
  tenantNetAmount: number | null;
  paidAt: string;
}

interface RecentPaymentsResponse {
  payments: RecentPayment[];
}

async function fetchRecentPayments(): Promise<RecentPaymentsResponse> {
  const res = await fetch('/api/admin/payments/recent', { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Failed to load recent payments');
  }
  return res.json();
}

function formatCents(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function CapabilityRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      {enabled ? (
        <Check className="w-4 h-4 text-green-600" aria-label="enabled" />
      ) : (
        <X className="w-4 h-4 text-gray-400" aria-label="disabled" />
      )}
    </div>
  );
}

export default function PaymentsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery<StripeConnectStatus>({
    queryKey: ['/api/admin/stripe/status'],
    queryFn: fetchStatus,
    staleTime: 30000,
  });

  const paymentsQuery = useQuery<RecentPaymentsResponse>({
    queryKey: ['/api/admin/payments/recent'],
    queryFn: fetchRecentPayments,
    staleTime: 30000,
  });

  const onboardMutation = useMutation({
    mutationFn: postOnboard,
    onSuccess: (data) => {
      // Redirect browser to Stripe-hosted onboarding URL
      window.location.href = data.url;
    },
    onError: (err: unknown) => {
      toast({
        title: 'Could not start onboarding',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: postRefresh,
    onSuccess: (result) => {
      if (result.notFound) {
        toast({
          title: 'No Stripe account yet',
          description: 'Connect first to refresh status.',
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/recent'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Refresh failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Return-from-Stripe handler — fires once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'success') {
      toast({
        title: 'Returned from Stripe',
        description: 'Refreshing status…',
      });
      refreshMutation.mutate();
      // Strip the query param so refresh doesn't re-fire on remount
      window.history.replaceState({}, '', '/admin/payments');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = query.data;

  // Determine primary button label based on state
  let primaryLabel = 'Connect Stripe Account';
  if (status?.connected && !status.detailsSubmitted) {
    primaryLabel = 'Continue Onboarding';
  } else if (status?.connected && status.detailsSubmitted) {
    primaryLabel = 'Update Stripe Account';
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          Payments
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect Stripe to receive customer payments directly to your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stripe Payments</CardTitle>
          <CardDescription>
            Connect your Stripe account to receive customer payments directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {query.isLoading && (
            <p className="text-sm text-muted-foreground">Loading payment status…</p>
          )}

          {query.isError && (
            <p className="text-sm text-destructive">
              {query.error instanceof Error
                ? query.error.message
                : 'Could not load payment status.'}
            </p>
          )}

          {status && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-32">Status</span>
                {status.connected ? (
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-600">Not Connected</Badge>
                )}
              </div>

              {status.connected && status.stripeAccountId && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-32">Account ID</span>
                  <span className="font-mono text-sm text-foreground">
                    {status.stripeAccountId}
                  </span>
                </div>
              )}

              <div className="pt-2 space-y-2 border-t">
                <CapabilityRow label="Charges Enabled" enabled={status.chargesEnabled} />
                <CapabilityRow label="Payouts Enabled" enabled={status.payoutsEnabled} />
                <CapabilityRow label="Details Submitted" enabled={status.detailsSubmitted} />
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => onboardMutation.mutate()}
              disabled={onboardMutation.isPending || query.isLoading}
              className="rounded-full bg-[#FFFF01] text-black font-bold hover:bg-yellow-300"
            >
              {onboardMutation.isPending ? 'Redirecting to Stripe…' : primaryLabel}
            </Button>

            {status?.connected && (
              <Button
                variant="outline"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
                />
                {refreshMutation.isPending ? 'Refreshing…' : 'Refresh Status'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>
            Last 20 completed bookings with platform fee breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : paymentsQuery.isError ? (
            <p className="text-sm text-destructive">
              {paymentsQuery.error instanceof Error
                ? paymentsQuery.error.message
                : 'Could not load recent payments.'}
            </p>
          ) : !paymentsQuery.data?.payments?.length ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Platform Fee</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentsQuery.data.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.paidAt).toLocaleDateString()}</TableCell>
                    <TableCell>{p.customerName}</TableCell>
                    <TableCell>{p.serviceName}</TableCell>
                    <TableCell>{formatCents(p.amountTotal)}</TableCell>
                    <TableCell className="text-red-600">
                      {p.platformFeeAmount != null ? `-${formatCents(p.platformFeeAmount)}` : '—'}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {formatCents(p.tenantNetAmount)}
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
