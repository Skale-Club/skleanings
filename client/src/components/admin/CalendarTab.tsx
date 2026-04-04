import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, Link, Loader2, Unlink } from 'lucide-react';

interface CalendarStatus {
  connected: boolean;
  calendarId?: string;
  connectedAt?: string;
  needsReconnect?: boolean;
}

export function CalendarTab({ staffId }: { staffId: number }) {
  const { toast } = useToast();

  const { data: status, isLoading, refetch } = useQuery<CalendarStatus>({
    queryKey: ['/api/staff', staffId, 'calendar', 'status'],
    queryFn: () => fetch(`/api/staff/${staffId}/calendar/status`).then(r => r.json()),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/staff/${staffId}/calendar`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: 'Google Calendar disconnected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to disconnect', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect a Google Calendar to automatically block this staff member's external appointments.
      </p>
      {status?.needsReconnect ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium text-sm">Calendar disconnected</span>
            </div>
            <p className="text-sm text-amber-700">
              Reconnect to resume availability sync. External appointments are not being blocked while disconnected.
            </p>
            <div className="flex items-center gap-2">
              <Button asChild size="sm">
                <a href={`/api/staff/${staffId}/calendar/connect`}>
                  <Link className="w-4 h-4 mr-2" />
                  Reconnect
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
                className="text-muted-foreground"
              >
                {disconnect.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4 mr-2" />
                )}
                Disconnect completely
              </Button>
            </div>
          </div>
        </div>
      ) : status?.connected ? (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-500" />
            <span className="font-medium text-sm">Connected</span>
            <Badge variant="secondary" className="text-xs">
              {status.calendarId || 'primary'}
            </Badge>
          </div>
          {status.connectedAt && (
            <p className="text-xs text-muted-foreground">
              Since {new Date(status.connectedAt).toLocaleDateString()}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="text-destructive hover:text-destructive"
            data-testid="button-disconnect-calendar"
          >
            {disconnect.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Unlink className="w-4 h-4 mr-2" />
            )}
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 space-y-3 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No calendar connected</p>
          <Button asChild size="sm" data-testid="button-connect-calendar">
            <a href={`/api/staff/${staffId}/calendar/connect`}>
              <Link className="w-4 h-4 mr-2" />
              Connect Google Calendar
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
