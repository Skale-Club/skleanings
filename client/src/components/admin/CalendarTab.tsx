import { useQuery, useMutation } from '@tanstack/react-query';
import { authenticatedRequest } from '@/lib/queryClient';
import { useAdminAuth } from '@/context/AuthContext';
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
  const { getAccessToken } = useAdminAuth();

  const { data: status, isLoading, refetch } = useQuery<CalendarStatus>({
    queryKey: ['/api/staff', staffId, 'calendar', 'status'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { connected: false };
      const res = await authenticatedRequest('GET', `/api/staff/${staffId}/calendar/status`, token);
      return res.json();
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return authenticatedRequest('DELETE', `/api/staff/${staffId}/calendar`, token);
    },
    onSuccess: () => {
      refetch();
      toast({ title: 'Google Calendar disconnected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to disconnect', description: error.message, variant: 'destructive' });
    },
  });

  const handleConnect = async () => {
    const token = await getAccessToken();
    const url = token
      ? `/api/staff/${staffId}/calendar/connect?token=${encodeURIComponent(token)}`
      : `/api/staff/${staffId}/calendar/connect`;
    window.location.href = url;
  };

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
              <Button size="sm" onClick={handleConnect}>
                <Link className="w-4 h-4 mr-2" />
                Reconnect
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
          <Button size="sm" onClick={handleConnect} data-testid="button-connect-calendar">
            <Link className="w-4 h-4 mr-2" />
            Connect Google Calendar
          </Button>
        </div>
      )}
    </div>
  );
}
