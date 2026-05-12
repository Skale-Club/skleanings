import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import type { IntegrationTabProps } from './types';

// Shape matches GET /api/integrations/calendar-sync/health response
interface TargetHealth {
  target: string;
  pendingCount: number;
  failedPermanentCount: number;
  recentFailures: {
    id: number;
    bookingId: number;
    lastError: string | null;
    lastAttemptAt: string | null;
    attempts: number;
  }[];
}

interface SyncHealthResponse {
  targets: TargetHealth[];
}

// Human-readable label for each target key
const TARGET_LABELS: Record<string, string> = {
  ghl_contact: 'GHL Contact',
  ghl_appointment: 'GHL Appointment',
  google_calendar: 'Google Calendar',
};

export function CalendarSyncTab({ getAccessToken }: IntegrationTabProps) {
  const { toast } = useToast();
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

  const { data, isLoading, error, refetch } = useQuery<SyncHealthResponse>({
    queryKey: ['/api/integrations/calendar-sync/health'],
    refetchInterval: 30_000, // auto-refresh every 30 seconds
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/integrations/calendar-sync/health', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch sync health');
      return res.json();
    },
  });

  // SYNC-06: Show warning banner when any target has >= 10 failed_permanent in last 24h
  const hasConsecutiveFailures = (data?.targets ?? []).some(
    (t) => t.failedPermanentCount >= 10
  );

  const handleRetry = async (jobId: number) => {
    setRetryingJobId(jobId);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Retry failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      const res = await fetch(`/api/integrations/calendar-sync/${jobId}/retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Retry request failed');
      }
      toast({ title: 'Job re-queued', description: `Job #${jobId} reset to pending` });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/calendar-sync/health'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Retry failed', description: message, variant: 'destructive' });
    } finally {
      setRetryingJobId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading sync health...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load sync health data. {(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  const targets = data?.targets ?? [];

  return (
    <div className="space-y-6">
      {/* SYNC-06: Consecutive failure banner */}
      {hasConsecutiveFailures && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            One or more sync targets have 10+ permanent failures in the last 24 hours.
            Check your GoHighLevel or Google Calendar configuration and retry failed jobs below.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold font-outfit">Calendar Sync Health</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary cards — one per target */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {targets.map((t) => (
          <Card key={t.target}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {TARGET_LABELS[t.target] ?? t.target}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Pending</span>
                <Badge variant={t.pendingCount > 0 ? 'secondary' : 'outline'}>
                  {t.pendingCount}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Failed (24h)</span>
                <Badge variant={t.failedPermanentCount >= 10 ? 'destructive' : t.failedPermanentCount > 0 ? 'secondary' : 'outline'}>
                  {t.failedPermanentCount}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Failure detail tables — one per target that has failures */}
      {targets.map((t) => {
        if (t.recentFailures.length === 0) return null;
        return (
          <div key={`table-${t.target}`}>
            <h4 className="text-sm font-semibold mb-2">
              {TARGET_LABELS[t.target] ?? t.target} — Recent Failures
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last Attempt</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.recentFailures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">#{f.id}</TableCell>
                    <TableCell>
                      <a
                        href={`/admin/bookings/${f.bookingId}`}
                        className="underline text-primary text-xs"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        #{f.bookingId}
                      </a>
                    </TableCell>
                    <TableCell>{f.attempts}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {f.lastAttemptAt
                        ? new Date(f.lastAttemptAt).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate">
                      {f.lastError ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={retryingJobId === f.id}
                        onClick={() => handleRetry(f.id)}
                      >
                        {retryingJobId === f.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Retry'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}

      {targets.every((t) => t.recentFailures.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No permanent failures in the queue. All syncs are healthy.
        </p>
      )}
    </div>
  );
}
