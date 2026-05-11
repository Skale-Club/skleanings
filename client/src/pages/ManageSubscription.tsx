import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Loader2, CheckCircle, PauseCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { apiRequest } from '@/lib/queryClient';

interface SubscriptionInfo {
  status: string;
  frequencyName: string;
  nextBookingDate: string | null;
  serviceName: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'active') return <CheckCircle className="w-10 h-10 text-green-500" />;
  if (status === 'paused') return <PauseCircle className="w-10 h-10 text-amber-500" />;
  return <XCircle className="w-10 h-10 text-red-500" />;
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <XCircle className="w-12 h-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold font-['Outfit'] text-[#1C53A3]">Link Not Found</h2>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  );
}

export default function ManageSubscription() {
  const [, params] = useRoute('/manage-subscription/:token');
  const token = params?.token ?? '';

  const [actionResult, setActionResult] = useState<string | null>(null);

  const {
    data: sub,
    isLoading,
    isError,
  } = useQuery<SubscriptionInfo>({
    queryKey: ['subscription', token],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/subscriptions/manage/${token}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('not_found');
        throw new Error('fetch_failed');
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      const res = await apiRequest('POST', `/api/subscriptions/manage/${token}/action`, { action });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error((err as { message?: string }).message ?? 'Request failed');
      }
      return res.json() as Promise<{ status: string }>;
    },
    onSuccess: (data) => {
      setActionResult(data.status);
    },
  });

  const currentStatus = actionResult ?? sub?.status;

  if (!token) {
    return <ErrorScreen message="No subscription token found in this link." />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorScreen message="This link is invalid or the subscription could not be found. Please check your email for the correct link." />
    );
  }

  if (!sub) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 space-y-6 shadow-sm">
        {/* Header */}
        <div className="text-center space-y-2">
          <StatusIcon status={currentStatus ?? sub.status} />
          <h1 className="text-2xl font-bold font-['Outfit'] text-[#1C53A3] mt-3">
            Manage Your Subscription
          </h1>
        </div>

        {/* Info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground font-medium">Service</span>
            <span className="font-semibold">{sub.serviceName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground font-medium">Frequency</span>
            <span className="font-semibold">{sub.frequencyName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground font-medium">Status</span>
            <Badge
              variant={
                currentStatus === 'active'
                  ? 'default'
                  : currentStatus === 'paused'
                    ? 'secondary'
                    : 'destructive'
              }
              className="capitalize"
            >
              {currentStatus ?? sub.status}
            </Badge>
          </div>
          {sub.nextBookingDate && currentStatus === 'active' && (
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground font-medium">Next booking</span>
              <span className="font-semibold">{formatDate(sub.nextBookingDate)}</span>
            </div>
          )}
        </div>

        {/* Action error */}
        {actionMutation.isError && (
          <p className="text-sm text-destructive text-center">
            {(actionMutation.error as Error)?.message ?? 'Something went wrong. Please try again.'}
          </p>
        )}

        {/* Actions */}
        {currentStatus === 'cancelled' ? (
          <div className="text-center text-muted-foreground text-sm py-4">
            This subscription has been cancelled. No further cleanings will be scheduled.
          </div>
        ) : (
          <div className="space-y-3">
            {currentStatus === 'active' ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={actionMutation.isPending}
                  >
                    {actionMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Pause my subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Pause your subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      We'll stop scheduling new cleanings until you resume. You can resume any
                      time using this same link.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep active</AlertDialogCancel>
                    <AlertDialogAction onClick={() => actionMutation.mutate('pause')}>
                      Pause
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                className="w-full bg-[#FFFF01] text-black font-bold rounded-full hover:bg-[#e6e600]"
                disabled={actionMutation.isPending}
                onClick={() => actionMutation.mutate('unpause')}
              >
                {actionMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Resume my subscription
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={actionMutation.isPending}
                >
                  Cancel subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently stops all future cleanings. This action cannot be undone.
                    Contact us if you'd like to restart.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => actionMutation.mutate('cancel')}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}
