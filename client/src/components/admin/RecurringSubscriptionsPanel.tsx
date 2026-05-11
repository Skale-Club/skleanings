import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { authenticatedRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface RecurringSubscriptionRow {
  id: number;
  contactName: string | null;
  serviceName: string;
  frequencyName: string;
  nextBookingDate: string;
  status: string;
  customerEmail: string | null;
}

interface RecurringSubscriptionsPanelProps {
  getAccessToken: () => Promise<string | null>;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'paused') return 'secondary';
  return 'destructive'; // cancelled
}

function formatNextDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function RecurringSubscriptionsPanel({ getAccessToken }: RecurringSubscriptionsPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: subscriptions, isLoading, isError } = useQuery<RecurringSubscriptionRow[]>({
    queryKey: ['admin', 'recurring-subscriptions'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('GET', '/api/admin/recurring-bookings', token);
      return res.json();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest(
        'PATCH',
        `/api/admin/recurring-bookings/${id}`,
        token,
        { action }
      );
      return res.json();
    },
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'recurring-subscriptions'] });
      const label = action === 'pause' ? 'paused' : action === 'cancel' ? 'cancelled' : 'resumed';
      toast({ title: `Subscription ${label}` });
    },
    onError: (err: Error) => {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading subscriptions…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-destructive">
        Failed to load subscriptions. Refresh the page to try again.
      </div>
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return (
      <div className="p-12 text-center rounded-lg bg-card border border-border">
        <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">No subscriptions yet</h3>
        <p className="text-muted-foreground">
          Recurring subscriptions will appear here when customers sign up for a recurring plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop table — hidden on mobile */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Service</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Frequency</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Next Date</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{sub.contactName ?? '—'}</div>
                  {sub.customerEmail && (
                    <div className="text-xs text-muted-foreground">{sub.customerEmail}</div>
                  )}
                </td>
                <td className="px-4 py-3">{sub.serviceName}</td>
                <td className="px-4 py-3">{sub.frequencyName}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadgeVariant(sub.status)} className="capitalize">
                    {sub.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">{formatNextDate(sub.nextBookingDate)}</td>
                <td className="px-4 py-3 text-right">
                  <SubscriptionActions
                    sub={sub}
                    isPending={actionMutation.isPending}
                    onAction={(action) => actionMutation.mutate({ id: sub.id, action })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {subscriptions.map((sub) => (
          <div key={sub.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{sub.contactName ?? '—'}</div>
                <div className="text-sm text-muted-foreground">
                  {sub.serviceName} · {sub.frequencyName}
                </div>
              </div>
              <Badge variant={statusBadgeVariant(sub.status)} className="capitalize shrink-0">
                {sub.status}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Next: {formatNextDate(sub.nextBookingDate)}
            </div>
            <div className="flex gap-2 flex-wrap pt-1">
              <SubscriptionActions
                sub={sub}
                isPending={actionMutation.isPending}
                onAction={(action) => actionMutation.mutate({ id: sub.id, action })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubscriptionActions({
  sub,
  isPending,
  onAction,
}: {
  sub: RecurringSubscriptionRow;
  isPending: boolean;
  onAction: (action: string) => void;
}) {
  if (sub.status === 'cancelled') {
    return <span className="text-xs text-muted-foreground italic">Cancelled</span>;
  }

  return (
    <div className="flex gap-2 flex-wrap justify-end">
      {/* Pause / Resume */}
      {sub.status === 'active' ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Pause
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Pause subscription?</AlertDialogTitle>
              <AlertDialogDescription>
                No new bookings will be generated until the subscription is resumed. Existing
                bookings are unaffected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep active</AlertDialogCancel>
              <AlertDialogAction onClick={() => onAction('pause')}>Pause</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => onAction('unpause')}
        >
          {isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          Resume
        </Button>
      )}

      {/* Cancel */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={isPending}>
            Cancel
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently stops future bookings for this subscription. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onAction('cancel')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
