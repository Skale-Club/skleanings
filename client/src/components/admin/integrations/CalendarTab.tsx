import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Loader2 } from 'lucide-react';
import type { IntegrationTabProps } from './types';

interface GoogleCalendarCredentials {
  apiKey: string;
  locationId: string;
  calendarId: string;
  isEnabled: boolean;
}

export function CalendarTab({ getAccessToken }: IntegrationTabProps) {
  const { toast } = useToast();
  const [creds, setCreds] = useState<GoogleCalendarCredentials>({ apiKey: '', locationId: '', calendarId: '', isEnabled: false });
  const [isSaving, setIsSaving] = useState(false);

  const { data: savedCreds, isLoading } = useQuery<GoogleCalendarCredentials>({
    queryKey: ['/api/integrations/google-calendar'],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch('/api/integrations/google-calendar', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch Google Calendar settings');
      return res.json();
    },
  });

  useEffect(() => { if (savedCreds) setCreds(savedCreds); }, [savedCreds]);

  const save = async () => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      await authenticatedRequest('PUT', '/api/integrations/google-calendar', token ?? '', creds);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/google-calendar'] });
      toast({ title: 'Google Calendar settings saved' });
    } catch {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  if (isLoading) return null;

  return (
    <Card className="border-0 bg-muted">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Google Calendar</CardTitle>
            <p className="text-sm text-muted-foreground">OAuth credentials for staff calendar sync</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gc-client-id">Client ID</Label>
            <Input id="gc-client-id" type="password" value={creds.apiKey}
              onChange={(e) => setCreds(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Google OAuth Client ID" data-testid="input-gc-client-id" />
            <p className="text-xs text-muted-foreground">From Google Cloud Console → Credentials → OAuth 2.0 Client IDs</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gc-client-secret">Client Secret</Label>
            <Input id="gc-client-secret" type="password" value={creds.locationId}
              onChange={(e) => setCreds(prev => ({ ...prev, locationId: e.target.value }))}
              placeholder="Google OAuth Client Secret" data-testid="input-gc-client-secret" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="gc-redirect-uri">Redirect URI</Label>
            <Input id="gc-redirect-uri" value={creds.calendarId}
              onChange={(e) => setCreds(prev => ({ ...prev, calendarId: e.target.value }))}
              placeholder="https://yourdomain.com/api/staff/calendar/callback" data-testid="input-gc-redirect-uri" />
            <p className="text-xs text-muted-foreground">Must match exactly what's configured in Google Cloud Console.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t">
          <Button onClick={save} disabled={isSaving} data-testid="button-save-google-calendar">
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </div>

        <div className="p-4 bg-muted/60 rounded-lg border text-sm space-y-1">
          <p className="font-medium">Setup instructions</p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
            <li>Go to Google Cloud Console and create an OAuth 2.0 Client ID (Web application)</li>
            <li>Add the Redirect URI above to the authorized list</li>
            <li>Paste Client ID and Client Secret here and save</li>
            <li>Each staff member can then connect their calendar from their settings panel</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
