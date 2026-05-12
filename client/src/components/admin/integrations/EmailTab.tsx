import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Mail } from 'lucide-react';
import type { IntegrationTabProps } from './types';

interface EmailSettings {
  enabled: boolean;
  resendApiKey: string;
  fromAddress: string;
}

const DEFAULT_SETTINGS: EmailSettings = { enabled: false, resendApiKey: '', fromAddress: '' };

export function EmailTab({ getAccessToken }: IntegrationTabProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const { data: emailSettings, isLoading } = useQuery<EmailSettings>({
    queryKey: ['/api/integrations/resend'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return DEFAULT_SETTINGS;
      const res = await fetch('/api/integrations/resend', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch email settings');
      return res.json();
    },
  });

  useEffect(() => { if (emailSettings) setSettings(emailSettings); }, [emailSettings]);

  const saveSettings = async (settingsToSave?: EmailSettings) => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      await authenticatedRequest('PUT', '/api/integrations/resend', token, settingsToSave || settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/resend'] });
      toast({ title: 'Settings saved successfully' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ title: 'Failed to save settings', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    const newSettings = { ...settings, enabled: checked };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const testSend = async () => {
    setIsTesting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      const response = await authenticatedRequest('POST', '/api/integrations/resend/test', token, {
        resendApiKey: settings.resendApiKey,
        fromAddress: settings.fromAddress,
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Test email sent', description: result.message });
      } else {
        toast({ title: 'Test failed', description: result.message || 'Could not send test email', variant: 'destructive' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ title: 'Test failed', description: message, variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="border-0 bg-muted">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Resend Email</CardTitle>
              <p className="text-sm text-muted-foreground">Transactional email for booking confirmations, reminders, and cancellations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Label htmlFor="email-enabled" className="text-sm">{settings.enabled ? 'Enabled' : 'Disabled'}</Label>
            <Switch id="email-enabled" checked={settings.enabled} onCheckedChange={handleToggleEnabled} disabled={isSaving} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="resend-api-key">Resend API Key</Label>
            <Input
              id="resend-api-key"
              type="password"
              value={settings.resendApiKey}
              onChange={(e) => setSettings(prev => ({ ...prev, resendApiKey: e.target.value }))}
              placeholder="re_••••••••••••••••••••••••"
            />
            <p className="text-xs text-muted-foreground">Find this in your Resend dashboard under API Keys</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resend-from-address">From Address</Label>
            <Input
              id="resend-from-address"
              type="text"
              value={settings.fromAddress}
              onChange={(e) => setSettings(prev => ({ ...prev, fromAddress: e.target.value }))}
              placeholder="Skleanings <no-reply@skleanings.com>"
            />
            <p className="text-xs text-muted-foreground">Must use a domain verified in your Resend account. 72h DNS propagation required before emails will deliver.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={testSend}
            disabled={isTesting || !settings.resendApiKey || !settings.fromAddress}
          >
            {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isTesting ? 'Sending...' : 'Send Test Email'}
          </Button>
          <Button onClick={() => saveSettings()} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </div>
        {settings.enabled && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Email integration active</p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">Customers will receive confirmation, reminder, and cancellation emails automatically</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
