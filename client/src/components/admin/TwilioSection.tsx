import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedRequest, apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, X, Check } from 'lucide-react';
import { SiTwilio } from 'react-icons/si';
import type { TwilioSettingsForm } from '@/components/admin/shared/types';
export function TwilioSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<TwilioSettingsForm>({
    enabled: false,
    accountSid: '',
    authToken: '',
    fromPhoneNumber: '',
    toPhoneNumbers: [],
    notifyOnNewChat: true
  });
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const { data: twilioSettings, isLoading } = useQuery<TwilioSettingsForm>({
    queryKey: ['/api/integrations/twilio'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/integrations/twilio', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch Twilio settings');
      return res.json();
    }
  });

  useEffect(() => {
    if (twilioSettings) {
      setSettings(twilioSettings);
    }
  }, [twilioSettings]);

  const isValidPhoneNumber = (phone: string): boolean => {
    return /^\+[1-9]\d{1,14}$/.test(phone);
  };

  const addPhoneNumber = () => {
    const trimmed = newPhoneNumber.trim();
    if (!trimmed) {
      toast({
        title: 'Invalid phone number',
        description: 'Phone number cannot be empty',
        variant: 'destructive'
      });
      return;
    }
    if (!isValidPhoneNumber(trimmed)) {
      toast({
        title: 'Invalid phone number',
        description: 'Phone number must be in E.164 format (e.g., +15551234567)',
        variant: 'destructive'
      });
      return;
    }
    if (settings.toPhoneNumbers.includes(trimmed)) {
      toast({
        title: 'Duplicate phone number',
        description: 'This phone number is already in the list',
        variant: 'destructive'
      });
      return;
    }
    setSettings(prev => ({
      ...prev,
      toPhoneNumbers: [...prev.toPhoneNumbers, trimmed]
    }));
    setNewPhoneNumber('');
    setTestResult('idle');
    setTestMessage(null);
  };

  const removePhoneNumber = (phone: string) => {
    setSettings(prev => ({
      ...prev,
      toPhoneNumbers: prev.toPhoneNumbers.filter(p => p !== phone)
    }));
    setTestResult('idle');
    setTestMessage(null);
  };

  const saveSettings = async () => {
    if (settings.toPhoneNumbers.length === 0) {
      toast({
        title: 'No phone numbers',
        description: 'Please add at least one phone number',
        variant: 'destructive'
      });
      return;
    }
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      await authenticatedRequest('PUT', '/api/integrations/twilio', token, settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/twilio'] });
      toast({ title: 'Twilio settings saved successfully' });
    } catch (error: any) {
      toast({
        title: 'Failed to save Twilio settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    if (settings.toPhoneNumbers.length === 0) {
      toast({
        title: 'No phone numbers',
        description: 'Please add at least one phone number to test',
        variant: 'destructive'
      });
      return;
    }
    setIsTesting(true);
    setTestResult('idle');
    setTestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        setIsTesting(false);
        return;
      }
      const response = await authenticatedRequest('POST', '/api/integrations/twilio/test', token, {
        accountSid: settings.accountSid,
        authToken: settings.authToken,
        fromPhoneNumber: settings.fromPhoneNumber,
        toPhoneNumbers: settings.toPhoneNumbers
      });
      const result = await response.json();

      if (result.success) {
        setTestResult('success');
        setTestMessage(result.message || 'Test message sent successfully!');
        toast({ title: 'Test successful', description: 'Check your phone(s) for the test message.' });
      } else {
        setTestResult('error');
        setTestMessage(result.message || 'Test failed');
        toast({
          title: 'Test failed',
          description: result.message || 'Could not send test message',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || 'Connection failed');
      toast({
        title: 'Test failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && testResult !== 'success') {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling Twilio.',
        variant: 'destructive'
      });
      return;
    }
    const newSettings = { ...settings, enabled: checked };
    setSettings(newSettings);
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/twilio', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/twilio'] });
      toast({ title: checked ? 'Twilio enabled' : 'Twilio disabled' });
    } catch (error: any) {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive'
      });
      setSettings(prev => ({ ...prev, enabled: !checked }));
    } finally {
      setIsSaving(false);
    }
  };

  const testButtonClass =
    testResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : testResult === 'error'
        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
        : '';

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-muted">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F22F46] dark:bg-[#F22F46] flex items-center justify-center">
                <SiTwilio className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Twilio SMS</CardTitle>
                <p className="text-sm text-muted-foreground">Get SMS notifications for new chat conversations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Label className="text-sm">
                {settings.enabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                checked={settings.enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isSaving}
                data-testid="switch-twilio-enabled"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="twilio-account-sid">Account SID</Label>
              <Input
                id="twilio-account-sid"
                type="text"
                value={settings.accountSid}
                onChange={(e) => setSettings(prev => ({ ...prev, accountSid: e.target.value }))}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                data-testid="input-twilio-account-sid"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-auth-token">Auth Token</Label>
              <Input
                id="twilio-auth-token"
                type="password"
                value={settings.authToken}
                onChange={(e) => setSettings(prev => ({ ...prev, authToken: e.target.value }))}
                placeholder="••••••••••••••••••••••••••••••••"
                data-testid="input-twilio-auth-token"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="twilio-from-phone">From Phone Number</Label>
              <Input
                id="twilio-from-phone"
                type="tel"
                value={settings.fromPhoneNumber}
                onChange={(e) => setSettings(prev => ({ ...prev, fromPhoneNumber: e.target.value }))}
                placeholder="+1234567890"
                data-testid="input-twilio-from-phone"
              />
              <p className="text-xs text-muted-foreground">
                Your Twilio phone number (with country code)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Phone numbers to receive notifications</Label>

              {/* List of existing phone numbers */}
              {settings.toPhoneNumbers.length > 0 && (
                <div className="space-y-2 mb-3">
                  {settings.toPhoneNumbers.map((phone, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 bg-muted rounded-md border"
                    >
                      <span className="text-sm font-mono">{phone}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePhoneNumber(phone)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid={`button-remove-phone-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input to add new phone number */}
              <div className="flex gap-2">
                <Input
                  type="tel"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPhoneNumber();
                    }
                  }}
                  placeholder="+1234567890"
                  data-testid="input-new-phone-number"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPhoneNumber}
                  className="shrink-0"
                  data-testid="button-add-phone"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add phone numbers in E.164 format (e.g., +15551234567)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify-new-chat"
              checked={settings.notifyOnNewChat}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifyOnNewChat: checked as boolean }))}
              data-testid="checkbox-notify-new-chat"
            />
            <Label htmlFor="notify-new-chat" className="text-sm font-normal cursor-pointer">
              Send SMS when a new chat conversation starts
            </Label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={saveSettings}
              disabled={isSaving}
              data-testid="button-save-twilio"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
            <Button
              variant="outline"
              className={testButtonClass}
              onClick={testConnection}
              disabled={isTesting || !settings.accountSid || !settings.authToken || !settings.fromPhoneNumber || settings.toPhoneNumbers.length === 0}
              data-testid="button-test-twilio"
            >
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {testResult === 'success' ? 'Test OK' : testResult === 'error' ? 'Test Failed' : 'Send Test SMS'}
            </Button>
          </div>

          {testMessage && (
            <div className={`p-3 rounded-lg text-sm ${testResult === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}>
              {testMessage}
            </div>
          )}

          {settings.enabled && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="w-4 h-4" />
                <span className="font-medium text-sm">Twilio is enabled</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                You'll receive SMS notifications when new chat conversations start
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


