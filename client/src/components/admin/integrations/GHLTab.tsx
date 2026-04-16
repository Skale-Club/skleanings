import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { GHLSettings } from '@/components/admin/shared/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Check, Loader2 } from 'lucide-react';
import type { IntegrationTabProps } from './types';

const ghlLogo = 'https://lsrlnlcdrshzzhqvklqc.supabase.co/storage/v1/object/public/skleanings/ghl-logo.webp';

export function GHLTab({ getAccessToken }: IntegrationTabProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GHLSettings>({ provider: 'gohighlevel', apiKey: '', locationId: '', calendarId: '', isEnabled: false });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: ghlSettings, isLoading } = useQuery<GHLSettings>({
    queryKey: ['/api/integrations/ghl'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/integrations/ghl', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch GHL settings');
      return res.json();
    },
  });

  useEffect(() => { if (ghlSettings) setSettings(ghlSettings); }, [ghlSettings]);

  const saveSettings = async (settingsToSave?: GHLSettings) => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) { toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' }); return; }
      await authenticatedRequest('PUT', '/api/integrations/ghl', token, settingsToSave || settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/ghl'] });
      toast({ title: 'Settings saved successfully' });
    } catch (error: any) {
      toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && testResult !== 'success') {
      toast({ title: 'Please run Test Connection', description: 'You must have a successful test before enabling GoHighLevel.', variant: 'destructive' }); return;
    }
    const newSettings = { ...settings, isEnabled: checked };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const testConnection = async () => {
    setIsTesting(true); setTestResult('idle');
    try {
      const token = await getAccessToken();
      if (!token) { toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' }); return; }
      const response = await authenticatedRequest('POST', '/api/integrations/ghl/test', token, { apiKey: settings.apiKey, locationId: settings.locationId });
      const result = await response.json();
      if (result.success) {
        setTestResult('success');
        await saveSettings(settings);
        toast({ title: 'Connection successful', description: 'Settings saved. You can now enable the integration.' });
      } else {
        setTestResult('error');
        toast({ title: 'Connection failed', description: result.message || 'Could not connect to GoHighLevel', variant: 'destructive' });
      }
    } catch (error: any) {
      setTestResult('error');
      toast({ title: 'Connection failed', description: error.message, variant: 'destructive' });
    } finally { setIsTesting(false); }
  };

  const testButtonClass = testResult === 'success'
    ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
    : testResult === 'error'
    ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
    : '';

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <Card className="border-0 bg-muted">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-transparent flex items-center justify-center overflow-hidden">
              <img src={ghlLogo} alt="GoHighLevel" className="w-9 h-9 rounded-md object-contain" />
            </div>
            <div>
              <CardTitle className="text-lg">GoHighLevel</CardTitle>
              <p className="text-sm text-muted-foreground">Sync calendars, contacts, and appointments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Label htmlFor="ghl-enabled" className="text-sm">{settings.isEnabled ? 'Enabled' : 'Disabled'}</Label>
            <Switch id="ghl-enabled" checked={settings.isEnabled} onCheckedChange={handleToggleEnabled} disabled={isSaving} data-testid="switch-ghl-enabled" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ghl-api-key">API Key</Label>
            <Input id="ghl-api-key" type="password" value={settings.apiKey}
              onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter your GoHighLevel API key" data-testid="input-ghl-api-key" />
            <p className="text-xs text-muted-foreground">Find this in your GHL account under Settings → Private Integrations</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ghl-location-id">Location ID</Label>
            <Input id="ghl-location-id" value={settings.locationId}
              onChange={(e) => setSettings(prev => ({ ...prev, locationId: e.target.value }))}
              placeholder="Enter your Location ID" data-testid="input-ghl-location-id" />
            <p className="text-xs text-muted-foreground">Your GHL sub-account/location identifier</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ghl-calendar-id">Calendar ID</Label>
            <Input id="ghl-calendar-id" value={settings.calendarId}
              onChange={(e) => setSettings(prev => ({ ...prev, calendarId: e.target.value }))}
              placeholder="Enter your Calendar ID" data-testid="input-ghl-calendar-id" />
            <p className="text-xs text-muted-foreground">ID of the GHL calendar to sync appointments with</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t">
          <Button variant="outline" className={testButtonClass} onClick={testConnection}
            disabled={isTesting || !settings.apiKey || !settings.locationId} data-testid="button-test-ghl">
            {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {testResult === 'success' ? 'Test OK' : testResult === 'error' ? 'Test Failed' : 'Test Connection'}
          </Button>
        </div>

        {settings.isEnabled && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Check className="w-4 h-4" />
              <span className="font-medium text-sm">Integration Active</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">New bookings will be synced to GoHighLevel automatically</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
