import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { SiOpenai } from 'react-icons/si';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { OpenAISettings, GeminiSettings, OpenRouterSettings } from '@/components/admin/shared/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Check, ChevronsUpDown, LayoutGrid, Loader2, Sparkles } from 'lucide-react';
import type { IntegrationTabProps } from './types';

interface OpenRouterModelOption {
  id: string;
  name?: string;
  contextLength?: number | null;
}

const testResultClass = (result: 'idle' | 'success' | 'error') =>
  result === 'success'
    ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
    : result === 'error'
    ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
    : '';

export function AITab({ getAccessToken }: IntegrationTabProps) {
  const { toast } = useToast();

  const [openAISettings, setOpenAISettings] = useState<OpenAISettings>({ provider: 'openai', enabled: false, model: 'gpt-4o-mini', hasKey: false });
  const [geminiSettings, setGeminiSettings] = useState<GeminiSettings>({ provider: 'gemini', enabled: false, model: 'gemini-2.5-flash', hasKey: false });
  const [openRouterSettings, setOpenRouterSettings] = useState<OpenRouterSettings>({ provider: 'openrouter', enabled: false, model: 'openai/gpt-4o-mini', hasKey: false });

  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');

  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState(false);

  const [isSavingOpenAI, setIsSavingOpenAI] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [isSavingOpenRouter, setIsSavingOpenRouter] = useState(false);

  const [openAITestResult, setOpenAITestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [openAITestMessage, setOpenAITestMessage] = useState<string | null>(null);
  const [geminiTestResult, setGeminiTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [geminiTestMessage, setGeminiTestMessage] = useState<string | null>(null);
  const [openRouterTestResult, setOpenRouterTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [openRouterTestMessage, setOpenRouterTestMessage] = useState<string | null>(null);

  const [openRouterModelPickerOpen, setOpenRouterModelPickerOpen] = useState(false);
  const [openRouterModelQuery, setOpenRouterModelQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('openai');

  const getTokenWithRetry = useCallback(async (): Promise<string | null> => {
    let token = await getAccessToken();
    if (!token) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      token = await getAccessToken();
    }
    return token;
  }, [getAccessToken]);

  const { data: openaiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/openai'],
    queryFn: async () => {
      const token = await getTokenWithRetry();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/openai', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch OpenAI settings');
      return res.json();
    },
  });

  const { data: geminiSettingsData } = useQuery<GeminiSettings>({
    queryKey: ['/api/integrations/gemini'],
    queryFn: async () => {
      const token = await getTokenWithRetry();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/gemini', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch Gemini settings');
      return res.json();
    },
  });

  const { data: openRouterSettingsData } = useQuery<OpenRouterSettings>({
    queryKey: ['/api/integrations/openrouter'],
    queryFn: async () => {
      const token = await getTokenWithRetry();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/openrouter', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch OpenRouter settings');
      return res.json();
    },
  });

  const { data: openRouterModelsData, isLoading: isLoadingOpenRouterModels } = useQuery<{ count: number; models: OpenRouterModelOption[] }>({
    queryKey: ['/api/integrations/openrouter/models'],
    enabled: openRouterSettings.hasKey || openRouterTestResult === 'success',
    queryFn: async () => {
      const token = await getTokenWithRetry();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/openrouter/models', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!res.ok) { const text = await res.text(); throw new Error(text || 'Failed to fetch models'); }
      return res.json();
    },
  });

  const { data: chatSettingsData } = useQuery<any>({
    queryKey: ['/api/chat/settings'],
    queryFn: async () => {
      const token = await getTokenWithRetry();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/chat/settings', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch chat settings');
      return res.json();
    },
  });

  useEffect(() => {
    if (chatSettingsData?.activeProvider && ['openai', 'gemini', 'openrouter'].includes(chatSettingsData.activeProvider)) {
      setActiveTab(chatSettingsData.activeProvider);
    }
  }, [chatSettingsData]);

  useEffect(() => {
    if (openaiSettingsData) {
      setOpenAISettings(openaiSettingsData);
      if (openaiSettingsData.hasKey) {
        setOpenAITestResult('success');
        setOpenAITestMessage(openaiSettingsData.enabled ? 'OpenAI is enabled.' : 'Key saved. Run test to verify connection.');
      }
    }
  }, [openaiSettingsData]);

  useEffect(() => {
    if (geminiSettingsData) {
      const normalizedModel = ['gemini-1.5-flash', 'gemini-1.5-pro'].includes(geminiSettingsData.model) ? 'gemini-2.5-flash' : geminiSettingsData.model;
      setGeminiSettings({ ...geminiSettingsData, model: normalizedModel });
      if (geminiSettingsData.hasKey) {
        setGeminiTestResult('success');
        setGeminiTestMessage(geminiSettingsData.enabled ? 'Gemini is enabled.' : 'Key saved. Run test to verify connection.');
      }
    }
  }, [geminiSettingsData]);

  useEffect(() => {
    if (openRouterSettingsData) {
      setOpenRouterSettings(openRouterSettingsData);
      if (openRouterSettingsData.hasKey) {
        setOpenRouterTestResult('success');
        setOpenRouterTestMessage(openRouterSettingsData.enabled ? 'OpenRouter is enabled.' : 'Key saved. Run test to verify connection.');
      }
    }
  }, [openRouterSettingsData]);

  const saveChatSettings = async (updates: any) => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await authenticatedRequest('PUT', '/api/chat/settings', token, updates);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/settings'] });
    } catch (error: any) {
      toast({ title: 'Error saving chat settings', description: error.message, variant: 'destructive' });
    }
  };

  const saveOpenAISettings = async (settingsToSave?: Partial<OpenAISettings> & { apiKey?: string }) => {
    setIsSavingOpenAI(true);
    try {
      const payload: any = {};
      if (settingsToSave && 'enabled' in settingsToSave && typeof settingsToSave.enabled === 'boolean') payload.enabled = settingsToSave.enabled;
      if (settingsToSave?.model) payload.model = settingsToSave.model;
      const keyToSend = settingsToSave?.apiKey || openAIApiKey;
      if (keyToSend && keyToSend !== '********') payload.apiKey = keyToSend;
      if (!Object.keys(payload).length) { payload.enabled = openAISettings.enabled; payload.model = openAISettings.model; }
      const token = await getTokenWithRetry();
      if (!token) { toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' }); return false; }
      const response = await authenticatedRequest('PUT', '/api/integrations/openai', token, payload);
      const updated = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
      setOpenAISettings(prev => ({ ...prev, ...updated, provider: 'openai' }));
      if (keyToSend) { setOpenAIApiKey(''); setOpenAISettings(prev => ({ ...prev, hasKey: true })); }
      toast({ title: 'OpenAI settings saved' });
      return true;
    } catch (error: any) {
      toast({ title: 'Failed to save OpenAI settings', description: error.message, variant: 'destructive' });
      return false;
    } finally { setIsSavingOpenAI(false); }
  };

  const saveGeminiSettings = async (settingsToSave?: Partial<GeminiSettings> & { apiKey?: string }) => {
    setIsSavingGemini(true);
    try {
      const payload: any = {};
      if (settingsToSave && 'enabled' in settingsToSave && typeof settingsToSave.enabled === 'boolean') payload.enabled = settingsToSave.enabled;
      if (settingsToSave?.model) payload.model = settingsToSave.model;
      const keyToSend = settingsToSave?.apiKey || geminiApiKey;
      if (keyToSend && keyToSend !== '********') payload.apiKey = keyToSend;
      if (!Object.keys(payload).length) { payload.enabled = geminiSettings.enabled; payload.model = geminiSettings.model; }
      const token = await getTokenWithRetry();
      if (!token) { toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' }); return false; }
      const response = await authenticatedRequest('PUT', '/api/integrations/gemini', token, payload);
      const updated = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/gemini'] });
      setGeminiSettings(prev => ({ ...prev, ...updated, provider: 'gemini' }));
      if (keyToSend) { setGeminiApiKey(''); setGeminiSettings(prev => ({ ...prev, hasKey: true })); }
      toast({ title: 'Gemini settings saved' });
      return true;
    } catch (error: any) {
      toast({ title: 'Failed to save Gemini settings', description: error.message, variant: 'destructive' });
      return false;
    } finally { setIsSavingGemini(false); }
  };

  const saveOpenRouterSettings = async (settingsToSave?: Partial<OpenRouterSettings> & { apiKey?: string }) => {
    setIsSavingOpenRouter(true);
    try {
      const payload: any = {};
      if (settingsToSave && 'enabled' in settingsToSave && typeof settingsToSave.enabled === 'boolean') payload.enabled = settingsToSave.enabled;
      if (settingsToSave?.model) payload.model = settingsToSave.model;
      const keyToSend = settingsToSave?.apiKey || openRouterApiKey;
      if (keyToSend && keyToSend !== '********') payload.apiKey = keyToSend;
      if (!Object.keys(payload).length) { payload.enabled = openRouterSettings.enabled; payload.model = openRouterSettings.model; }
      const token = await getTokenWithRetry();
      if (!token) { toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' }); return false; }
      const response = await authenticatedRequest('PUT', '/api/integrations/openrouter', token, payload);
      const updated = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter/models'] });
      setOpenRouterSettings(prev => ({ ...prev, ...updated, provider: 'openrouter' }));
      if (keyToSend) { setOpenRouterApiKey(''); setOpenRouterSettings(prev => ({ ...prev, hasKey: true })); }
      toast({ title: 'OpenRouter settings saved' });
      return true;
    } catch (error: any) {
      toast({ title: 'Failed to save OpenRouter settings', description: error.message, variant: 'destructive' });
      return false;
    } finally { setIsSavingOpenRouter(false); }
  };

  const handleToggleOpenAI = async (checked: boolean) => {
    if (checked && !(openAITestResult === 'success' || openAISettings.hasKey)) {
      toast({ title: 'Please run Test Connection', description: 'You must have a successful test before enabling OpenAI.', variant: 'destructive' }); return;
    }
    const previous = openAISettings;
    setOpenAISettings({ ...previous, enabled: checked });
    if (checked) { setOpenAITestResult('success'); setOpenAITestMessage('OpenAI is enabled.'); }
    else { setOpenAITestResult('idle'); setOpenAITestMessage(null); }
    const saved = await saveOpenAISettings({ enabled: checked });
    if (!saved) {
      setOpenAISettings(previous);
      if (previous.hasKey) { setOpenAITestResult('success'); setOpenAITestMessage(previous.enabled ? 'OpenAI is enabled.' : 'Key saved. Run test to verify connection.'); }
      else { setOpenAITestResult('idle'); setOpenAITestMessage(null); }
    }
  };

  const handleToggleGemini = async (checked: boolean) => {
    if (checked && !(geminiTestResult === 'success' || geminiSettings.hasKey)) {
      toast({ title: 'Please run Test Connection', description: 'You must have a successful test before enabling Gemini.', variant: 'destructive' }); return;
    }
    const previous = geminiSettings;
    setGeminiSettings({ ...previous, enabled: checked });
    if (checked) { setGeminiTestResult('success'); setGeminiTestMessage('Gemini is enabled.'); }
    else { setGeminiTestResult('idle'); setGeminiTestMessage(null); }
    const saved = await saveGeminiSettings({ enabled: checked });
    if (!saved) {
      setGeminiSettings(previous);
      if (previous.hasKey) { setGeminiTestResult('success'); setGeminiTestMessage(previous.enabled ? 'Gemini is enabled.' : 'Key saved. Run test to verify connection.'); }
      else { setGeminiTestResult('idle'); setGeminiTestMessage(null); }
    }
  };

  const handleToggleOpenRouter = async (checked: boolean) => {
    if (checked && !(openRouterTestResult === 'success' || openRouterSettings.hasKey)) {
      toast({ title: 'Please run Test Connection', description: 'You must have a successful test before enabling OpenRouter.', variant: 'destructive' }); return;
    }
    const previous = openRouterSettings;
    setOpenRouterSettings({ ...previous, enabled: checked });
    if (checked) { setOpenRouterTestResult('success'); setOpenRouterTestMessage('OpenRouter is enabled.'); }
    else { setOpenRouterTestResult('idle'); setOpenRouterTestMessage(null); }
    const saved = await saveOpenRouterSettings({ enabled: checked });
    if (!saved) {
      setOpenRouterSettings(previous);
      if (previous.hasKey) { setOpenRouterTestResult('success'); setOpenRouterTestMessage(previous.enabled ? 'OpenRouter is enabled.' : 'Key saved. Run test to verify connection.'); }
      else { setOpenRouterTestResult('idle'); setOpenRouterTestMessage(null); }
    }
  };

  const parseTestResponse = async (response: Response) => {
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try { return text ? JSON.parse(text) : {}; } catch { return { success: false, message: text || 'Unexpected response' }; }
    }
    const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
    return { success: false, message: `Unexpected response (status ${response.status}). Snippet: ${snippet}` };
  };

  const testOpenAIConnection = async () => {
    setIsTestingOpenAI(true); setOpenAITestResult('idle'); setOpenAITestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) { toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' }); return; }
      const response = await authenticatedRequest('POST', '/api/integrations/openai/test', token, { apiKey: openAIApiKey || undefined, model: openAISettings.model });
      const result = await parseTestResponse(response);
      if (result.success) {
        setOpenAITestResult('success'); setOpenAITestMessage('Connection successful. You can now enable OpenAI.');
        setOpenAISettings(prev => ({ ...prev, hasKey: true })); setOpenAIApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
        toast({ title: 'OpenAI connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setOpenAITestResult('error'); setOpenAITestMessage(result.message || 'Could not reach OpenAI.');
        toast({ title: 'OpenAI test failed', description: result.message || 'Could not reach OpenAI', variant: 'destructive' });
      }
    } catch (error: any) {
      setOpenAITestResult('error'); setOpenAITestMessage(error.message || 'Connection failed.');
      toast({ title: 'OpenAI test failed', description: error.message, variant: 'destructive' });
    } finally { setIsTestingOpenAI(false); }
  };

  const testGeminiConnection = async () => {
    setIsTestingGemini(true); setGeminiTestResult('idle'); setGeminiTestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) { toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' }); return; }
      const response = await authenticatedRequest('POST', '/api/integrations/gemini/test', token, { apiKey: geminiApiKey || undefined, model: geminiSettings.model });
      const result = await parseTestResponse(response);
      if (result.success) {
        setGeminiTestResult('success'); setGeminiTestMessage('Connection successful. You can now enable Gemini.');
        setGeminiSettings(prev => ({ ...prev, hasKey: true })); setGeminiApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/gemini'] });
        toast({ title: 'Gemini connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setGeminiTestResult('error'); setGeminiTestMessage(result.message || 'Could not reach Gemini.');
        toast({ title: 'Gemini test failed', description: result.message || 'Could not reach Gemini', variant: 'destructive' });
      }
    } catch (error: any) {
      setGeminiTestResult('error'); setGeminiTestMessage(error.message || 'Connection failed.');
      toast({ title: 'Gemini test failed', description: error.message, variant: 'destructive' });
    } finally { setIsTestingGemini(false); }
  };

  const testOpenRouterConnection = async () => {
    setIsTestingOpenRouter(true); setOpenRouterTestResult('idle'); setOpenRouterTestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) { toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' }); return; }
      const response = await authenticatedRequest('POST', '/api/integrations/openrouter/test', token, { apiKey: openRouterApiKey || undefined, model: openRouterSettings.model });
      const result = await parseTestResponse(response);
      if (result.success) {
        setOpenRouterTestResult('success'); setOpenRouterTestMessage('Connection successful. You can now enable OpenRouter.');
        setOpenRouterSettings(prev => ({ ...prev, hasKey: true })); setOpenRouterApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter'] });
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter/models'] });
        toast({ title: 'OpenRouter connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setOpenRouterTestResult('error'); setOpenRouterTestMessage(result.message || 'Could not reach OpenRouter.');
        toast({ title: 'OpenRouter test failed', description: result.message || 'Could not reach OpenRouter', variant: 'destructive' });
      }
    } catch (error: any) {
      setOpenRouterTestResult('error'); setOpenRouterTestMessage(error.message || 'Connection failed.');
      toast({ title: 'OpenRouter test failed', description: error.message, variant: 'destructive' });
    } finally { setIsTestingOpenRouter(false); }
  };

  const openRouterModels = openRouterModelsData?.models || [];
  const filteredOpenRouterModels = useMemo(() => {
    const query = openRouterModelQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    if (!query) return openRouterModels;
    const tokens = query.split(/\s+/).filter(Boolean);
    return openRouterModels.filter((model) => {
      const searchable = `${model.id} ${model.name || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      return tokens.every((t) => searchable.includes(t));
    });
  }, [openRouterModels, openRouterModelQuery]);

  const statusBadge = (enabled: boolean) => (
    <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
      enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
               : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>
      {enabled ? 'ON' : 'OFF'}
    </span>
  );

  return (
    <Card className="border-0 bg-muted">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">AI Assistant</CardTitle>
            <p className="text-sm text-muted-foreground">Configure your AI-powered chat assistant</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); saveChatSettings({ activeProvider: val }); }} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-2 bg-background p-1 mb-2">
            <TabsTrigger value="openai" className="flex items-center justify-between rounded-md px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-sm">
              <span className="flex items-center gap-2"><SiOpenai className="w-4 h-4" /><span>OpenAI</span></span>
              {statusBadge(openAISettings.enabled)}
            </TabsTrigger>
            <TabsTrigger value="gemini" className="flex items-center justify-between rounded-md px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-sm">
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /><span>Gemini</span></span>
              {statusBadge(geminiSettings.enabled)}
            </TabsTrigger>
            <TabsTrigger value="openrouter" className="flex items-center justify-between rounded-md px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-sm">
              <span className="flex items-center gap-2"><LayoutGrid className="w-4 h-4" /><span>OpenRouter</span></span>
              {statusBadge(openRouterSettings.enabled)}
            </TabsTrigger>
          </TabsList>
          <p className="mb-6 text-xs text-muted-foreground">
            Active in chat now: <span className="font-medium text-foreground">{activeTab === 'gemini' ? 'Gemini' : activeTab === 'openrouter' ? 'OpenRouter' : 'OpenAI'}</span>
          </p>

          {/* OpenAI */}
          <TabsContent value="openai" className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
              <div className="space-y-0.5">
                <Label className="text-base">Enable OpenAI</Label>
                <p className="text-sm text-muted-foreground">Use ChatGPT models for responses</p>
              </div>
              <div className="flex items-center gap-2">
                {isSavingOpenAI && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <Switch checked={openAISettings.enabled} onCheckedChange={handleToggleOpenAI} disabled={isSavingOpenAI} data-testid="switch-openai-enabled" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="openai-api-key">API Key</Label>
                <Input id="openai-api-key" type="password"
                  value={openAIApiKey || (openAISettings.hasKey ? '********' : '')}
                  onChange={(e) => { const v = e.target.value; setOpenAIApiKey(v === '********' ? '' : v); }}
                  onFocus={(e) => { if (e.target.value === '********') setOpenAIApiKey(''); }}
                  placeholder="sk-..." data-testid="input-openai-api-key" />
                <p className="text-xs text-muted-foreground">Stored securely on the server. Not returned after saving.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openai-model">Model</Label>
                <Select value={openAISettings.model} onValueChange={(val) => { setOpenAISettings(prev => ({ ...prev, model: val })); saveOpenAISettings({ model: val }); }}>
                  <SelectTrigger id="openai-model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5">gpt-5</SelectItem>
                    <SelectItem value="gpt-5-mini">gpt-5-mini</SelectItem>
                    <SelectItem value="gpt-5-nano">gpt-5-nano</SelectItem>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                    <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                    <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                    <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button variant="outline" className={testResultClass(openAITestResult)} onClick={testOpenAIConnection}
                disabled={isTestingOpenAI || (!openAIApiKey && !openAISettings.hasKey)} data-testid="button-test-openai">
                {isTestingOpenAI && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {openAITestResult === 'success' ? 'Test OK' : openAITestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>
            </div>
            {openAITestMessage && (openAITestResult === 'error' || !openAISettings.enabled) && (
              <div className={`p-3 rounded-lg text-sm ${openAITestResult === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                {openAITestMessage}
              </div>
            )}
          </TabsContent>

          {/* Gemini */}
          <TabsContent value="gemini" className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Gemini</Label>
                <p className="text-sm text-muted-foreground">Use Gemini models for responses</p>
              </div>
              <div className="flex items-center gap-2">
                {isSavingGemini && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <Switch checked={geminiSettings.enabled} onCheckedChange={handleToggleGemini} disabled={isSavingGemini} data-testid="switch-gemini-enabled" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gemini-api-key">API Key</Label>
                <Input id="gemini-api-key" type="password"
                  value={geminiApiKey || (geminiSettings.hasKey ? '********' : '')}
                  onChange={(e) => { const v = e.target.value; setGeminiApiKey(v === '********' ? '' : v); }}
                  onFocus={(e) => { if (e.target.value === '********') setGeminiApiKey(''); }}
                  placeholder="AI..." data-testid="input-gemini-api-key" />
                <p className="text-xs text-muted-foreground">Stored securely on the server. Not returned after saving.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gemini-model">Model</Label>
                <Select value={geminiSettings.model} onValueChange={(val) => { setGeminiSettings(prev => ({ ...prev, model: val })); saveGeminiSettings({ model: val }); }}>
                  <SelectTrigger id="gemini-model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                    <SelectItem value="gemini-3.0-flash">Gemini 3.0 Flash</SelectItem>
                    <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                    <SelectItem value="gemini-3.0-pro">Gemini 3.0 Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button variant="outline" className={testResultClass(geminiTestResult)} onClick={testGeminiConnection}
                disabled={isTestingGemini || (!geminiApiKey && !geminiSettings.hasKey)} data-testid="button-test-gemini">
                {isTestingGemini && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {geminiTestResult === 'success' ? 'Test OK' : geminiTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>
            </div>
            {geminiTestMessage && (geminiTestResult === 'error' || !geminiSettings.enabled) && (
              <div className={`p-3 rounded-lg text-sm ${geminiTestResult === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                {geminiTestMessage}
              </div>
            )}
          </TabsContent>

          {/* OpenRouter */}
          <TabsContent value="openrouter" className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
              <div className="space-y-0.5">
                <Label className="text-base">Enable OpenRouter</Label>
                <p className="text-sm text-muted-foreground">Use OpenRouter models for responses</p>
              </div>
              <div className="flex items-center gap-2">
                {isSavingOpenRouter && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <Switch checked={openRouterSettings.enabled} onCheckedChange={handleToggleOpenRouter} disabled={isSavingOpenRouter} data-testid="switch-openrouter-enabled" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="openrouter-api-key">API Key</Label>
                <Input id="openrouter-api-key" type="password"
                  value={openRouterApiKey || (openRouterSettings.hasKey ? '********' : '')}
                  onChange={(e) => { const v = e.target.value; setOpenRouterApiKey(v === '********' ? '' : v); }}
                  onFocus={(e) => { if (e.target.value === '********') setOpenRouterApiKey(''); }}
                  placeholder="sk-or-v1-..." data-testid="input-openrouter-api-key" />
                <p className="text-xs text-muted-foreground">Stored securely on the server. Not returned after saving.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openrouter-model">Model</Label>
                <Popover open={openRouterModelPickerOpen} onOpenChange={(open) => { setOpenRouterModelPickerOpen(open); if (!open) setOpenRouterModelQuery(''); }}>
                  <PopoverTrigger asChild>
                    <Button id="openrouter-model" variant="ghost" role="combobox" aria-expanded={openRouterModelPickerOpen}
                      className="h-9 w-full justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground shadow-none hover:bg-background hover:text-foreground"
                      disabled={!openRouterSettings.hasKey} data-testid="combobox-openrouter-model">
                      <span className="truncate">{openRouterSettings.model || 'Select model'}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search models..." value={openRouterModelQuery} onValueChange={setOpenRouterModelQuery} />
                      <CommandList>
                        <CommandEmpty>
                          {!openRouterSettings.hasKey ? 'Save/test key first to load models.' : isLoadingOpenRouterModels ? 'Loading models...' : 'No models found.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredOpenRouterModels.map((model) => (
                            <CommandItem key={model.id} value={`${model.id} ${model.name || ''}`}
                              className="data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900 dark:data-[selected=true]:bg-slate-800 dark:data-[selected=true]:text-slate-100"
                              onSelect={() => { setOpenRouterSettings(prev => ({ ...prev, model: model.id })); saveOpenRouterSettings({ model: model.id }); setOpenRouterModelQuery(''); setOpenRouterModelPickerOpen(false); }}>
                              <Check className={clsx('mr-2 h-4 w-4', openRouterSettings.model === model.id ? 'opacity-100' : 'opacity-0')} />
                              <div className="min-w-0">
                                <div className="truncate">{model.id}</div>
                                {model.name && model.name !== model.id && <div className="truncate text-xs text-muted-foreground">{model.name}</div>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  {openRouterSettings.hasKey ? `Showing ${openRouterModels.length} models from OpenRouter.` : 'Connect and test your OpenRouter key to load all available models.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button variant="outline" className={testResultClass(openRouterTestResult)} onClick={testOpenRouterConnection}
                disabled={isTestingOpenRouter || (!openRouterApiKey && !openRouterSettings.hasKey)} data-testid="button-test-openrouter">
                {isTestingOpenRouter && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {openRouterTestResult === 'success' ? 'Test OK' : openRouterTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>
            </div>
            {openRouterTestMessage && (openRouterTestResult === 'error' || !openRouterSettings.enabled) && (
              <div className={`p-3 rounded-lg text-sm ${openRouterTestResult === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                {openRouterTestMessage}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
