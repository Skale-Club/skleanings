import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Send, X, Check } from 'lucide-react';
import type { TelegramSettingsForm } from '@/components/admin/shared/types';

export function TelegramSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<TelegramSettingsForm>({
    enabled: false,
    botToken: '',
    chatIds: [],
    notifyOnNewChat: true,
  });
  const [newChatId, setNewChatId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [telegramTestPassed, setTelegramTestPassed] = useState(false);

  const { data: telegramSettings, isLoading } = useQuery<TelegramSettingsForm>({
    queryKey: ['/api/integrations/telegram'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/telegram', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch Telegram settings');
      return res.json();
    },
  });

  useEffect(() => {
    if (!telegramSettings) return;
    setSettings(telegramSettings);
    setTelegramTestPassed(Boolean(telegramSettings.enabled));
  }, [telegramSettings]);

  const isValidChatId = (chatId: string): boolean => {
    const value = chatId.trim();
    return /^-?\d+$/.test(value) || /^@[A-Za-z0-9_]{5,}$/.test(value);
  };

  const addChatId = () => {
    const trimmed = newChatId.trim();
    if (!trimmed) {
      toast({
        title: 'Invalid chat ID',
        description: 'Chat ID cannot be empty',
        variant: 'destructive',
      });
      return;
    }
    if (!isValidChatId(trimmed)) {
      toast({
        title: 'Invalid chat ID',
        description: 'Use a numeric chat ID (for groups/users) or @channel_username',
        variant: 'destructive',
      });
      return;
    }
    if (settings.chatIds.includes(trimmed)) {
      toast({
        title: 'Duplicate chat ID',
        description: 'This chat ID is already in the list',
        variant: 'destructive',
      });
      return;
    }

    setSettings((prev) => ({ ...prev, chatIds: [...prev.chatIds, trimmed] }));
    setNewChatId('');
    setTelegramTestPassed(false);
    setTestResult('idle');
    setTestMessage(null);
  };

  const removeChatId = (chatId: string) => {
    setSettings((prev) => ({
      ...prev,
      chatIds: prev.chatIds.filter((id) => id !== chatId),
    }));
    setTelegramTestPassed(false);
    setTestResult('idle');
    setTestMessage(null);
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      await authenticatedRequest('PUT', '/api/integrations/telegram', token, settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/telegram'] });
      toast({ title: 'Telegram settings saved successfully' });
    } catch (error: any) {
      toast({
        title: 'Failed to save Telegram settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    if (!settings.botToken || settings.chatIds.length === 0) {
      toast({
        title: 'Missing fields',
        description: 'Bot token and at least one chat ID are required',
        variant: 'destructive',
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
        return;
      }

      const response = await authenticatedRequest('POST', '/api/integrations/telegram/test', token, {
        botToken: settings.botToken,
        chatIds: settings.chatIds,
      });
      const result = await response.json();

      if (result.success) {
        setTestResult('success');
        setTestMessage(result.message || 'Test message sent successfully');
        setTelegramTestPassed(true);
        toast({ title: 'Test successful', description: 'Check Telegram for the test message.' });
      } else {
        setTestResult('error');
        setTestMessage(result.message || 'Test failed');
        setTelegramTestPassed(false);
        toast({
          title: 'Test failed',
          description: result.message || 'Could not send test message',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || 'Connection failed');
      setTelegramTestPassed(false);
      toast({
        title: 'Test failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && !telegramTestPassed) {
      toast({
        title: 'Run test first',
        description: 'You must run a successful test before enabling Telegram.',
        variant: 'destructive',
      });
      return;
    }

    const next = { ...settings, enabled: checked };
    setSettings(next);
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      await authenticatedRequest('PUT', '/api/integrations/telegram', token, next);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/telegram'] });
      toast({ title: checked ? 'Telegram enabled' : 'Telegram disabled' });
    } catch (error: any) {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive',
      });
      setSettings((prev) => ({ ...prev, enabled: !checked }));
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
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-muted">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#229ED9] flex items-center justify-center">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Telegram Alerts</CardTitle>
                <p className="text-sm text-muted-foreground">Get Telegram notifications for new chats and bookings</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Label className="text-sm">{settings.enabled ? 'Enabled' : 'Disabled'}</Label>
              <Switch
                checked={settings.enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isSaving}
                data-testid="switch-telegram-enabled"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="telegram-bot-token">Bot Token</Label>
            <Input
              id="telegram-bot-token"
              type="password"
              value={settings.botToken}
              onChange={(e) => {
                setSettings((prev) => ({ ...prev, botToken: e.target.value }));
                setTelegramTestPassed(false);
                setTestResult('idle');
                setTestMessage(null);
              }}
              placeholder="123456789:AAExampleToken"
              data-testid="input-telegram-bot-token"
            />
          </div>

          <div className="space-y-2">
            <Label>Chat IDs to receive notifications</Label>

            {settings.chatIds.length > 0 && (
              <div className="space-y-2 mb-3">
                {settings.chatIds.map((chatId, index) => (
                  <div
                    key={chatId}
                    className="flex items-center justify-between gap-2 p-2 bg-muted rounded-md border"
                  >
                    <span className="text-sm font-mono">{chatId}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChatId(chatId)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid={`button-remove-chat-id-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                type="text"
                value={newChatId}
                onChange={(e) => setNewChatId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChatId();
                  }
                }}
                placeholder="-1001234567890 or @channel_name"
                data-testid="input-new-chat-id"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addChatId}
                className="shrink-0"
                data-testid="button-add-chat-id"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add numeric chat IDs (example: -1001234567890) or public channels (@channel_name)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify-telegram-new-chat"
              checked={settings.notifyOnNewChat}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, notifyOnNewChat: checked as boolean }))}
              data-testid="checkbox-notify-telegram-new-chat"
            />
            <Label htmlFor="notify-telegram-new-chat" className="text-sm font-normal cursor-pointer">
              Send Telegram message when a new chat conversation starts
            </Label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button onClick={saveSettings} disabled={isSaving} data-testid="button-save-telegram">
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
            <Button
              variant="outline"
              className={testButtonClass}
              onClick={testConnection}
              disabled={isTesting || !settings.botToken || settings.chatIds.length === 0}
              data-testid="button-test-telegram"
            >
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {testResult === 'success' ? 'Test OK' : testResult === 'error' ? 'Test Failed' : 'Send Test Message'}
            </Button>
          </div>

          {testMessage && (
            <div
              className={`p-3 rounded-lg text-sm ${
                testResult === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}
            >
              {testMessage}
            </div>
          )}

          {settings.enabled && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="w-4 h-4" />
                <span className="font-medium text-sm">Telegram is enabled</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                Notifications will be sent to your configured chats
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
