import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { SiFacebook, SiGoogleanalytics, SiGoogletagmanager, SiOpenai } from 'react-icons/si';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type {
  AnalyticsSettings,
  GeminiSettings,
  GHLSettings,
  OpenAISettings,
  OpenRouterSettings,
} from '@/components/admin/shared/types';
import { TwilioSection } from '@/components/admin/TwilioSection';
import { TelegramSection } from '@/components/admin/TelegramSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Check, ChevronsUpDown, LayoutGrid, Loader2, Sparkles } from 'lucide-react';

const ghlLogo = 'https://lsrlnlcdrshzzhqvklqc.supabase.co/storage/v1/object/public/skleanings/ghl-logo.webp';

interface OpenRouterModelOption {
  id: string;
  name?: string;
  contextLength?: number | null;
}

export function IntegrationsSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GHLSettings>({
    provider: 'gohighlevel',
    apiKey: '',
    locationId: '',
    calendarId: '',
    isEnabled: false
  });
  const [openAISettings, setOpenAISettings] = useState<OpenAISettings>({
    provider: 'openai',
    enabled: false,
    model: 'gpt-4o-mini',
    hasKey: false
  });
  const [geminiSettings, setGeminiSettings] = useState<GeminiSettings>({
    provider: 'gemini',
    enabled: false,
    model: 'gemini-2.5-flash',
    hasKey: false
  });
  const [openRouterSettings, setOpenRouterSettings] = useState<OpenRouterSettings>({
    provider: 'openrouter',
    enabled: false,
    model: 'openai/gpt-4o-mini',
    hasKey: false
  });

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

  const [analyticsSettings, setAnalyticsSettings] = useState<AnalyticsSettings>({
    gtmContainerId: '',
    ga4MeasurementId: '',
    facebookPixelId: '',
    gtmEnabled: false,
    ga4Enabled: false,
    facebookPixelEnabled: false
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAnalytics, setIsSavingAnalytics] = useState(false);
  const [lastSavedAnalytics, setLastSavedAnalytics] = useState<Date | null>(null);
  const saveAnalyticsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ghlTestResult, setGhlTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const integrationsMenuTitle = 'Integrations';

  const { data: ghlSettings, isLoading } = useQuery<GHLSettings>({
    queryKey: ['/api/integrations/ghl'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/integrations/ghl', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch GHL settings');
      return res.json();
    }
  });

  const { data: openaiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/openai'],
    queryFn: async () => {
      let token = await getAccessToken();
      if (!token) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await getAccessToken();
      }
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/openai', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch OpenAI settings');
      return res.json();
    }
  });

  const { data: geminiSettingsData } = useQuery<GeminiSettings>({
    queryKey: ['/api/integrations/gemini'],
    queryFn: async () => {
      let token = await getAccessToken();
      if (!token) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await getAccessToken();
      }
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/gemini', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch Gemini settings');
      return res.json();
    }
  });

  const { data: openRouterSettingsData } = useQuery<OpenRouterSettings>({
    queryKey: ['/api/integrations/openrouter'],
    queryFn: async () => {
      let token = await getAccessToken();
      if (!token) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await getAccessToken();
      }
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/openrouter', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch OpenRouter settings');
      return res.json();
    }
  });

  const { data: openRouterModelsData, isLoading: isLoadingOpenRouterModels } = useQuery<{ count: number; models: OpenRouterModelOption[] }>({
    queryKey: ['/api/integrations/openrouter/models'],
    enabled: openRouterSettings.hasKey || openRouterTestResult === 'success',
    queryFn: async () => {
      let token = await getAccessToken();
      if (!token) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await getAccessToken();
      }
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/openrouter/models', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to fetch OpenRouter models');
      }
      return res.json();
    }
  });

  const { data: chatSettingsData } = useQuery<any>({
    queryKey: ['/api/chat/settings'],
    queryFn: async () => {
      let token = await getAccessToken();
      if (!token) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await getAccessToken();
      }
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/chat/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch chat settings');
      return res.json();
    }
  });

  const [activeTab, setActiveTab] = useState<string>('openai');

  const getTokenWithRetry = useCallback(async (): Promise<string | null> => {
    let token = await getAccessToken();
    if (!token) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      token = await getAccessToken();
    }
    return token;
  }, [getAccessToken]);

  useEffect(() => {
    if (chatSettingsData?.activeProvider && ['openai', 'gemini', 'openrouter'].includes(chatSettingsData.activeProvider)) {
      setActiveTab(chatSettingsData.activeProvider);
    }
  }, [chatSettingsData]);

  const saveChatSettings = async (updates: any) => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await authenticatedRequest('PUT', '/api/chat/settings', token, updates);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/settings'] });
    } catch (error: any) {
      toast({
        title: 'Error saving chat settings',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const { data: companySettings } = useQuery<any>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (ghlSettings) {
      setSettings(ghlSettings);
    }
  }, [ghlSettings]);

  useEffect(() => {
    if (openaiSettingsData) {
      setOpenAISettings(openaiSettingsData);
      if (openaiSettingsData.hasKey) {
        setOpenAITestResult('success');
        setOpenAITestMessage(openaiSettingsData.enabled ? 'OpenAI is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setOpenAITestResult('idle');
        setOpenAITestMessage(null);
      }
    }
  }, [openaiSettingsData]);

  useEffect(() => {
    if (geminiSettingsData) {
      const normalizedGeminiModel =
        geminiSettingsData.model === 'gemini-1.5-flash' || geminiSettingsData.model === 'gemini-1.5-pro'
          ? 'gemini-2.5-flash'
          : geminiSettingsData.model;
      setGeminiSettings({
        ...geminiSettingsData,
        model: normalizedGeminiModel,
      });
      if (geminiSettingsData.hasKey) {
        setGeminiTestResult('success');
        setGeminiTestMessage(geminiSettingsData.enabled ? 'Gemini is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setGeminiTestResult('idle');
        setGeminiTestMessage(null);
      }
    }
  }, [geminiSettingsData]);

  useEffect(() => {
    if (openRouterSettingsData) {
      setOpenRouterSettings(openRouterSettingsData);
      if (openRouterSettingsData.hasKey) {
        setOpenRouterTestResult('success');
        setOpenRouterTestMessage(openRouterSettingsData.enabled ? 'OpenRouter is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setOpenRouterTestResult('idle');
        setOpenRouterTestMessage(null);
      }
    }
  }, [openRouterSettingsData]);

  useEffect(() => {
    if (companySettings) {
      setAnalyticsSettings({
        gtmContainerId: companySettings.gtmContainerId || '',
        ga4MeasurementId: companySettings.ga4MeasurementId || '',
        facebookPixelId: companySettings.facebookPixelId || '',
        gtmEnabled: companySettings.gtmEnabled || false,
        ga4Enabled: companySettings.ga4Enabled || false,
        facebookPixelEnabled: companySettings.facebookPixelEnabled || false
      });
    }
  }, [companySettings]);

  useEffect(() => {
    return () => {
      if (saveAnalyticsTimeoutRef.current) {
        clearTimeout(saveAnalyticsTimeoutRef.current);
      }
    };
  }, []);

  const saveAnalyticsSettings = useCallback(async (newSettings: Partial<AnalyticsSettings>) => {
    setIsSavingAnalytics(true);
    try {
      const token = await getTokenWithRetry();
      if (!token) {
        throw new Error('Authentication required');
      }
      await authenticatedRequest('PUT', '/api/company-settings', token, newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSavedAnalytics(new Date());
    } catch (error: any) {
      toast({
        title: 'Error saving analytics settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSavingAnalytics(false);
    }
  }, [getTokenWithRetry, toast]);

  const updateAnalyticsField = useCallback(<K extends keyof AnalyticsSettings>(field: K, value: AnalyticsSettings[K]) => {
    setAnalyticsSettings(prev => {
      const next = { ...prev, [field]: value };

      if (saveAnalyticsTimeoutRef.current) {
        clearTimeout(saveAnalyticsTimeoutRef.current);
      }

      saveAnalyticsTimeoutRef.current = setTimeout(() => {
        saveAnalyticsSettings(next);
      }, 800);

      return next;
    });
  }, [saveAnalyticsSettings]);

  const saveOpenAISettings = async (settingsToSave?: Partial<OpenAISettings> & { apiKey?: string }) => {
    setIsSavingOpenAI(true);
    try {
      const payload: any = {};
      if (settingsToSave && 'enabled' in settingsToSave && typeof settingsToSave.enabled === 'boolean') {
        payload.enabled = settingsToSave.enabled;
      }
      if (settingsToSave?.model) {
        payload.model = settingsToSave.model;
      }

      // Only send API key if it's provided and not masked
      const keyToSend = settingsToSave?.apiKey || openAIApiKey;
      if (keyToSend && keyToSend !== '********') {
        payload.apiKey = keyToSend;
      }

      // Fallback for callers that provide no explicit partial update
      if (!Object.keys(payload).length) {
        payload.enabled = openAISettings.enabled;
        payload.model = openAISettings.model;
      }

      const token = await getTokenWithRetry();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return false;
      }
      const response = await authenticatedRequest('PUT', '/api/integrations/openai', token, payload);
      const updated = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
      setOpenAISettings((prev) => ({
        ...prev,
        ...updated,
        provider: 'openai',
      }));

      // Clear local input but keep hasKey state
      if (keyToSend) {
        setOpenAIApiKey('');
        setOpenAISettings(prev => ({ ...prev, hasKey: true }));
      }

      toast({ title: 'OpenAI settings saved' });
      return true;
    } catch (error: any) {
      toast({
        title: 'Failed to save OpenAI settings',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsSavingOpenAI(false);
    }
  };

  const saveGeminiSettings = async (settingsToSave?: Partial<GeminiSettings> & { apiKey?: string }) => {
    setIsSavingGemini(true);
    try {
      const payload: any = {};
      if (settingsToSave && 'enabled' in settingsToSave && typeof settingsToSave.enabled === 'boolean') {
        payload.enabled = settingsToSave.enabled;
      }
      if (settingsToSave?.model) {
        payload.model = settingsToSave.model;
      }

      const keyToSend = settingsToSave?.apiKey || geminiApiKey;
      if (keyToSend && keyToSend !== '********') {
        payload.apiKey = keyToSend;
      }

      // Fallback for callers that provide no explicit partial update
      if (!Object.keys(payload).length) {
        payload.enabled = geminiSettings.enabled;
        payload.model = geminiSettings.model;
      }

      const token = await getTokenWithRetry();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return false;
      }
      const response = await authenticatedRequest('PUT', '/api/integrations/gemini', token, payload);
      const updated = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/gemini'] });
      setGeminiSettings((prev) => ({
        ...prev,
        ...updated,
        provider: 'gemini',
      }));

      if (keyToSend) {
        setGeminiApiKey('');
        setGeminiSettings(prev => ({ ...prev, hasKey: true }));
      }

      toast({ title: 'Gemini settings saved' });
      return true;
    } catch (error: any) {
      toast({
        title: 'Failed to save Gemini settings',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsSavingGemini(false);
    }
  };

  const saveOpenRouterSettings = async (settingsToSave?: Partial<OpenRouterSettings> & { apiKey?: string }) => {
    setIsSavingOpenRouter(true);
    try {
      const payload: any = {};
      if (settingsToSave && 'enabled' in settingsToSave && typeof settingsToSave.enabled === 'boolean') {
        payload.enabled = settingsToSave.enabled;
      }
      if (settingsToSave?.model) {
        payload.model = settingsToSave.model;
      }

      const keyToSend = settingsToSave?.apiKey || openRouterApiKey;
      if (keyToSend && keyToSend !== '********') {
        payload.apiKey = keyToSend;
      }

      if (!Object.keys(payload).length) {
        payload.enabled = openRouterSettings.enabled;
        payload.model = openRouterSettings.model;
      }

      const token = await getTokenWithRetry();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return false;
      }
      const response = await authenticatedRequest('PUT', '/api/integrations/openrouter', token, payload);
      const updated = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter/models'] });
      setOpenRouterSettings((prev) => ({
        ...prev,
        ...updated,
        provider: 'openrouter',
      }));

      if (keyToSend) {
        setOpenRouterApiKey('');
        setOpenRouterSettings(prev => ({ ...prev, hasKey: true }));
      }

      toast({ title: 'OpenRouter settings saved' });
      return true;
    } catch (error: any) {
      toast({
        title: 'Failed to save OpenRouter settings',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsSavingOpenRouter(false);
    }
  };


  const handleToggleOpenAI = async (checked: boolean) => {
    if (checked && !(openAITestResult === 'success' || openAISettings.hasKey)) {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling OpenAI.',
        variant: 'destructive'
      });
      return;
    }
    const previous = openAISettings;
    const next = { ...previous, enabled: checked };
    setOpenAISettings(next);
    if (checked) {
      setOpenAITestResult('success');
      setOpenAITestMessage('OpenAI is enabled.');
    } else {
      setOpenAITestResult('idle');
      setOpenAITestMessage(null);
    }
    const saved = await saveOpenAISettings({ enabled: checked });
    if (!saved) {
      setOpenAISettings(previous);
      if (previous.hasKey) {
        setOpenAITestResult('success');
        setOpenAITestMessage(previous.enabled ? 'OpenAI is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setOpenAITestResult('idle');
        setOpenAITestMessage(null);
      }
    }
  };

  const handleToggleGemini = async (checked: boolean) => {
    if (checked && !(geminiTestResult === 'success' || geminiSettings.hasKey)) {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling Gemini.',
        variant: 'destructive'
      });
      return;
    }
    const previous = geminiSettings;
    const next = { ...previous, enabled: checked };
    setGeminiSettings(next);
    if (checked) {
      setGeminiTestResult('success');
      setGeminiTestMessage('Gemini is enabled.');
    } else {
      setGeminiTestResult('idle');
      setGeminiTestMessage(null);
    }
    const saved = await saveGeminiSettings({ enabled: checked });
    if (!saved) {
      setGeminiSettings(previous);
      if (previous.hasKey) {
        setGeminiTestResult('success');
        setGeminiTestMessage(previous.enabled ? 'Gemini is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setGeminiTestResult('idle');
        setGeminiTestMessage(null);
      }
    }
  };

  const handleToggleOpenRouter = async (checked: boolean) => {
    if (checked && !(openRouterTestResult === 'success' || openRouterSettings.hasKey)) {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling OpenRouter.',
        variant: 'destructive'
      });
      return;
    }
    const previous = openRouterSettings;
    const next = { ...previous, enabled: checked };
    setOpenRouterSettings(next);
    if (checked) {
      setOpenRouterTestResult('success');
      setOpenRouterTestMessage('OpenRouter is enabled.');
    } else {
      setOpenRouterTestResult('idle');
      setOpenRouterTestMessage(null);
    }
    const saved = await saveOpenRouterSettings({ enabled: checked });
    if (!saved) {
      setOpenRouterSettings(previous);
      if (previous.hasKey) {
        setOpenRouterTestResult('success');
        setOpenRouterTestMessage(previous.enabled ? 'OpenRouter is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setOpenRouterTestResult('idle');
        setOpenRouterTestMessage(null);
      }
    }
  };


  const testOpenAIConnection = async () => {
    setIsTestingOpenAI(true);
    setOpenAITestResult('idle');
    setOpenAITestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        setIsTestingOpenAI(false);
        return;
      }
      const response = await authenticatedRequest('POST', '/api/integrations/openai/test', token, {
        apiKey: openAIApiKey || undefined,
        model: openAISettings.model
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = {};
      if (contentType.includes('application/json')) {
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { success: false, message: text || 'Unexpected response from server' };
        }
      } else {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
        result = {
          success: false,
          message: `Unexpected response (status ${response.status}, content-type: ${contentType || 'unknown'}). The API route may not be running. Try restarting the server and testing again. Snippet: ${snippet}`
        };
      }
      if (result.success) {
        setOpenAITestResult('success');
        setOpenAITestMessage('Connection successful. You can now enable OpenAI.');
        setOpenAISettings(prev => ({ ...prev, hasKey: true }));
        setOpenAIApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
        toast({ title: 'OpenAI connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setOpenAITestResult('error');
        setOpenAITestMessage(result.message || 'Could not reach OpenAI.');
        toast({
          title: 'OpenAI test failed',
          description: result.message || 'Could not reach OpenAI',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'OpenAI test failed',
        description: error.message,
        variant: 'destructive'
      });
      setOpenAITestResult('error');
      setOpenAITestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingOpenAI(false);
    }
  };


  const testGeminiConnection = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult('idle');
    setGeminiTestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        setIsTestingGemini(false);
        return;
      }

      // Pass model to test endpoint
      const response = await authenticatedRequest('POST', '/api/integrations/gemini/test', token, {
        apiKey: geminiApiKey || undefined,
        model: geminiSettings.model
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = {};
      if (contentType.includes('application/json')) {
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { success: false, message: text || 'Unexpected response from server' };
        }
      } else {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
        result = {
          success: false,
          message: `Unexpected response (status ${response.status}, content-type: ${contentType || 'unknown'}). The API route may not be running. Try restarting the server and testing again. Snippet: ${snippet}`
        };
      }
      if (result.success) {
        setGeminiTestResult('success');
        setGeminiTestMessage('Connection successful. You can now enable Gemini.');
        setGeminiSettings(prev => ({ ...prev, hasKey: true }));
        setGeminiApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/gemini'] });
        toast({ title: 'Gemini connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setGeminiTestResult('error');
        setGeminiTestMessage(result.message || 'Could not reach Gemini.');
        toast({
          title: 'Gemini test failed',
          description: result.message || 'Could not reach Gemini',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Gemini test failed',
        description: error.message,
        variant: 'destructive'
      });
      setGeminiTestResult('error');
      setGeminiTestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingGemini(false);
    }
  };

  const testOpenRouterConnection = async () => {
    setIsTestingOpenRouter(true);
    setOpenRouterTestResult('idle');
    setOpenRouterTestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        setIsTestingOpenRouter(false);
        return;
      }

      const response = await authenticatedRequest('POST', '/api/integrations/openrouter/test', token, {
        apiKey: openRouterApiKey || undefined,
        model: openRouterSettings.model
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = {};
      if (contentType.includes('application/json')) {
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { success: false, message: text || 'Unexpected response from server' };
        }
      } else {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
        result = {
          success: false,
          message: `Unexpected response (status ${response.status}, content-type: ${contentType || 'unknown'}). The API route may not be running. Try restarting the server and testing again. Snippet: ${snippet}`
        };
      }
      if (result.success) {
        setOpenRouterTestResult('success');
        setOpenRouterTestMessage('Connection successful. You can now enable OpenRouter.');
        setOpenRouterSettings(prev => ({ ...prev, hasKey: true }));
        setOpenRouterApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter'] });
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter/models'] });
        toast({ title: 'OpenRouter connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setOpenRouterTestResult('error');
        setOpenRouterTestMessage(result.message || 'Could not reach OpenRouter.');
        toast({
          title: 'OpenRouter test failed',
          description: result.message || 'Could not reach OpenRouter',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'OpenRouter test failed',
        description: error.message,
        variant: 'destructive'
      });
      setOpenRouterTestResult('error');
      setOpenRouterTestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingOpenRouter(false);
    }
  };


  const ghlTestButtonClass =
    ghlTestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : ghlTestResult === 'error'
        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
        : '';

  const openAITestButtonClass =
    openAITestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : openAITestResult === 'error'
        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
        : '';

  const geminiTestButtonClass =
    geminiTestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : geminiTestResult === 'error'
        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
        : '';

  const openRouterTestButtonClass =
    openRouterTestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : openRouterTestResult === 'error'
        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
        : '';

  const openRouterModels = openRouterModelsData?.models || [];
  const filteredOpenRouterModels = useMemo(() => {
    const query = openRouterModelQuery
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    if (!query) return openRouterModels;

    const tokens = query.split(/\s+/).filter(Boolean);
    if (!tokens.length) return openRouterModels;

    return openRouterModels.filter((model) => {
      const searchable = `${model.id} ${model.name || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

      return tokens.every((token) => searchable.includes(token));
    });
  }, [openRouterModels, openRouterModelQuery]);

  const hasGtmId = analyticsSettings.gtmContainerId.trim().length > 0;
  const hasGa4Id = analyticsSettings.ga4MeasurementId.trim().length > 0;
  const hasFacebookPixelId = analyticsSettings.facebookPixelId.trim().length > 0;

  const saveSettings = async (settingsToSave?: GHLSettings) => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      await authenticatedRequest('PUT', '/api/integrations/ghl', token, settingsToSave || settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/ghl'] });
      toast({ title: 'Settings saved successfully' });
    } catch (error: any) {
      toast({
        title: 'Failed to save settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && ghlTestResult !== 'success') {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling GoHighLevel.',
        variant: 'destructive'
      });
      return;
    }
    const newSettings = { ...settings, isEnabled: checked };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setGhlTestResult('idle');
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        setIsTesting(false);
        return;
      }
      const response = await authenticatedRequest('POST', '/api/integrations/ghl/test', token, {
        apiKey: settings.apiKey,
        locationId: settings.locationId
      });
      const result = await response.json();

      if (result.success) {
        setGhlTestResult('success');
        await saveSettings(settings);
        toast({ title: 'Connection successful', description: 'Settings saved. You can now enable the integration.' });
      } else {
        setGhlTestResult('error');
        toast({
          title: 'Connection failed',
          description: result.message || 'Could not connect to GoHighLevel',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setGhlTestResult('error');
      toast({
        title: 'Connection failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{integrationsMenuTitle}</h1>
        <p className="text-muted-foreground">Connect your booking system with external services</p>
      </div>

      <div className="space-y-4">
        <Card className="border-0 bg-muted">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">AI Assistant</CardTitle>
                  <p className="text-sm text-muted-foreground">Configure your AI-powered chat assistant</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs 
              value={activeTab} 
              onValueChange={(val) => {
                setActiveTab(val);
                saveChatSettings({ activeProvider: val });
              }}
              className="w-full"
            >
              <TabsList className="grid h-auto w-full grid-cols-3 gap-2 bg-background p-1 mb-2">
                <TabsTrigger
                  value="openai"
                  className="flex items-center justify-between rounded-md px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <SiOpenai className="w-4 h-4" />
                    <span>OpenAI</span>
                  </span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      openAISettings.enabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {openAISettings.enabled ? "ON" : "OFF"}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="gemini"
                  className="flex items-center justify-between rounded-md px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Gemini</span>
                  </span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      geminiSettings.enabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {geminiSettings.enabled ? "ON" : "OFF"}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="openrouter"
                  className="flex items-center justify-between rounded-md px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    <span>OpenRouter</span>
                  </span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      openRouterSettings.enabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {openRouterSettings.enabled ? "ON" : "OFF"}
                  </span>
                </TabsTrigger>
              </TabsList>
              <p className="mb-6 text-xs text-muted-foreground">
                Active in chat now: <span className="font-medium text-foreground">{activeTab === 'gemini' ? 'Gemini' : activeTab === 'openrouter' ? 'OpenRouter' : 'OpenAI'}</span>
              </p>

              <TabsContent value="openai" className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable OpenAI</Label>
                    <p className="text-sm text-muted-foreground">Use ChatGPT models for responses</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSavingOpenAI && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={openAISettings.enabled}
                      onCheckedChange={handleToggleOpenAI}
                      disabled={isSavingOpenAI}
                      data-testid="switch-openai-enabled"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="openai-api-key">API Key</Label>
                    <Input
                      id="openai-api-key"
                      type="password"
                      value={openAIApiKey || (openAISettings.hasKey ? '********' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '********') {
                          setOpenAIApiKey('');
                        } else {
                          setOpenAIApiKey(val);
                        }
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '********') {
                          setOpenAIApiKey('');
                        }
                      }}
                      placeholder="sk-..."
                      data-testid="input-openai-api-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Stored securely on the server. Not returned after saving.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openai-model">Model</Label>
                    <Select
                      value={openAISettings.model}
                      onValueChange={(val) => {
                        setOpenAISettings(prev => ({ ...prev, model: val }));
                        saveOpenAISettings({ model: val });
                      }}
                    >
                      <SelectTrigger id="openai-model">
                        <SelectValue />
                      </SelectTrigger>
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
                  <Button
                    variant="outline"
                    className={openAITestButtonClass}
                    onClick={testOpenAIConnection}
                    disabled={isTestingOpenAI || (!openAIApiKey && !openAISettings.hasKey)}
                    data-testid="button-test-openai"
                  >
                    {isTestingOpenAI && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {openAITestResult === 'success' ? 'Test OK' : openAITestResult === 'error' ? 'Test Failed' : 'Test Connection'}
                  </Button>
                </div>

                {openAITestMessage && (openAITestResult === 'error' || !openAISettings.enabled) && (
                  <div className={`p-3 rounded-lg text-sm ${openAITestResult === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}>
                    {openAITestMessage}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="gemini" className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Gemini</Label>
                    <p className="text-sm text-muted-foreground">Use Gemini models for responses</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSavingGemini && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={geminiSettings.enabled}
                      onCheckedChange={handleToggleGemini}
                      disabled={isSavingGemini}
                      data-testid="switch-gemini-enabled"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gemini-api-key">API Key</Label>
                    <Input
                      id="gemini-api-key"
                      type="password"
                      value={geminiApiKey || (geminiSettings.hasKey ? '********' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '********') {
                          setGeminiApiKey('');
                        } else {
                          setGeminiApiKey(val);
                        }
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '********') {
                          setGeminiApiKey('');
                        }
                      }}
                      placeholder="AI..."
                      data-testid="input-gemini-api-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Stored securely on the server. Not returned after saving.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gemini-model">Model</Label>
                    <Select
                      value={geminiSettings.model}
                      onValueChange={(val) => {
                        setGeminiSettings(prev => ({ ...prev, model: val }));
                        saveGeminiSettings({ model: val });
                      }}
                    >
                      <SelectTrigger id="gemini-model">
                        <SelectValue />
                      </SelectTrigger>
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
                  <Button
                    variant="outline"
                    className={geminiTestButtonClass}
                    onClick={testGeminiConnection}
                    disabled={isTestingGemini || (!geminiApiKey && !geminiSettings.hasKey)}
                    data-testid="button-test-gemini"
                  >
                    {isTestingGemini && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {geminiTestResult === 'success' ? 'Test OK' : geminiTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
                  </Button>
                </div>

                {geminiTestMessage && (geminiTestResult === 'error' || !geminiSettings.enabled) && (
                  <div className={`p-3 rounded-lg text-sm ${geminiTestResult === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}>
                    {geminiTestMessage}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="openrouter" className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable OpenRouter</Label>
                    <p className="text-sm text-muted-foreground">Use OpenRouter models for responses</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSavingOpenRouter && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={openRouterSettings.enabled}
                      onCheckedChange={handleToggleOpenRouter}
                      disabled={isSavingOpenRouter}
                      data-testid="switch-openrouter-enabled"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="openrouter-api-key">API Key</Label>
                    <Input
                      id="openrouter-api-key"
                      type="password"
                      value={openRouterApiKey || (openRouterSettings.hasKey ? '********' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '********') {
                          setOpenRouterApiKey('');
                        } else {
                          setOpenRouterApiKey(val);
                        }
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '********') {
                          setOpenRouterApiKey('');
                        }
                      }}
                      placeholder="sk-or-v1-..."
                      data-testid="input-openrouter-api-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Stored securely on the server. Not returned after saving.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openrouter-model">Model</Label>
                    <Popover
                      open={openRouterModelPickerOpen}
                      onOpenChange={(open) => {
                        setOpenRouterModelPickerOpen(open);
                        if (!open) setOpenRouterModelQuery('');
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          id="openrouter-model"
                          variant="ghost"
                          role="combobox"
                          aria-expanded={openRouterModelPickerOpen}
                          className="h-9 w-full justify-between rounded-md border border-[#c8d7eb] bg-background px-3 py-2 text-sm font-normal text-foreground shadow-none hover:bg-background hover:text-foreground focus-visible:border-[#b8cfee] focus-visible:ring-1 focus-visible:ring-[#b8cfee] focus-visible:ring-offset-0"
                          disabled={!openRouterSettings.hasKey}
                          data-testid="combobox-openrouter-model"
                        >
                          <span className="truncate">
                            {openRouterSettings.model || 'Select model'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search models..."
                            value={openRouterModelQuery}
                            onValueChange={setOpenRouterModelQuery}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {!openRouterSettings.hasKey
                                ? 'Save/test key first to load models.'
                                : isLoadingOpenRouterModels
                                  ? 'Loading models...'
                                  : 'No models found.'}
                            </CommandEmpty>
                            <CommandGroup>
                              {filteredOpenRouterModels.map((model) => (
                                <CommandItem
                                  key={model.id}
                                  value={`${model.id} ${model.name || ''}`}
                                  className="data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900 dark:data-[selected=true]:bg-slate-800 dark:data-[selected=true]:text-slate-100"
                                  onSelect={() => {
                                    setOpenRouterSettings(prev => ({ ...prev, model: model.id }));
                                    saveOpenRouterSettings({ model: model.id });
                                    setOpenRouterModelQuery('');
                                    setOpenRouterModelPickerOpen(false);
                                  }}
                                >
                                  <Check
                                    className={clsx(
                                      "mr-2 h-4 w-4",
                                      openRouterSettings.model === model.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate">{model.id}</div>
                                    {model.name && model.name !== model.id && (
                                      <div className="truncate text-xs text-muted-foreground">{model.name}</div>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      {openRouterSettings.hasKey
                        ? `Showing ${openRouterModels.length} models from OpenRouter. Use search to find the best one.`
                        : 'Connect and test your OpenRouter key to load all available models.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    className={openRouterTestButtonClass}
                    onClick={testOpenRouterConnection}
                    disabled={isTestingOpenRouter || (!openRouterApiKey && !openRouterSettings.hasKey)}
                    data-testid="button-test-openrouter"
                  >
                    {isTestingOpenRouter && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {openRouterTestResult === 'success' ? 'Test OK' : openRouterTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
                  </Button>
                </div>

                {openRouterTestMessage && (openRouterTestResult === 'error' || !openRouterSettings.enabled) && (
                  <div className={`p-3 rounded-lg text-sm ${openRouterTestResult === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}>
                    {openRouterTestMessage}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
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
                <Label htmlFor="ghl-enabled" className="text-sm">
                  {settings.isEnabled ? 'Enabled' : 'Disabled'}
                </Label>
                <Switch
                  id="ghl-enabled"
                  checked={settings.isEnabled}
                  onCheckedChange={handleToggleEnabled}
                  disabled={isSaving}
                  data-testid="switch-ghl-enabled"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ghl-api-key">API Key</Label>
                <Input
                  id="ghl-api-key"
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter your GoHighLevel API key"
                  data-testid="input-ghl-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your GHL account under Settings {'->'} Private Integrations
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ghl-location-id">Location ID</Label>
                <Input
                  id="ghl-location-id"
                  value={settings.locationId}
                  onChange={(e) => setSettings(prev => ({ ...prev, locationId: e.target.value }))}
                  placeholder="Enter your Location ID"
                  data-testid="input-ghl-location-id"
                />
                <p className="text-xs text-muted-foreground">
                  Your GHL sub-account/location identifier
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ghl-calendar-id">Calendar ID</Label>
                <Input
                  id="ghl-calendar-id"
                  value={settings.calendarId}
                  onChange={(e) => setSettings(prev => ({ ...prev, calendarId: e.target.value }))}
                  placeholder="Enter your Calendar ID"
                  data-testid="input-ghl-calendar-id"
                />
                <p className="text-xs text-muted-foreground">ID of the GHL calendar to sync appointments with</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                className={ghlTestButtonClass}
                onClick={testConnection}
                disabled={isTesting || !settings.apiKey || !settings.locationId}
                data-testid="button-test-ghl"
              >
                {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {ghlTestResult === 'success' ? 'Test OK' : ghlTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>
            </div>

            {settings.isEnabled && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">Integration Active</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  New bookings will be synced to GoHighLevel automatically
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TelegramSection getAccessToken={getAccessToken} />
      <TwilioSection getAccessToken={getAccessToken} />

      <div className="space-y-6">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          <Card className="border-0 bg-muted">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <SiGoogletagmanager className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                  </div>
                  <CardTitle className="text-base">Google Tag Manager</CardTitle>
                </div>
                <Switch
                  checked={analyticsSettings.gtmEnabled}
                  onCheckedChange={(checked) => updateAnalyticsField('gtmEnabled', checked)}
                  data-testid="switch-gtm-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="gtm-id" className="text-sm">Container ID</Label>
                <Input
                  id="gtm-id"
                  value={analyticsSettings.gtmContainerId}
                  onChange={(e) => updateAnalyticsField('gtmContainerId', e.target.value)}
                  placeholder="GTM-XXXXXXX"
                  className="text-sm"
                  data-testid="input-gtm-id"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in GTM under Admin {'->'} Container Settings
              </p>
              {analyticsSettings.gtmEnabled && hasGtmId && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 bg-muted">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <SiGoogleanalytics className="w-4 h-4 text-[#E37400] dark:text-[#FFB74D]" />
                  </div>
                  <CardTitle className="text-base">Google Analytics 4</CardTitle>
                </div>
                <Switch
                  checked={analyticsSettings.ga4Enabled}
                  onCheckedChange={(checked) => updateAnalyticsField('ga4Enabled', checked)}
                  data-testid="switch-ga4-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ga4-id" className="text-sm">Measurement ID</Label>
                <Input
                  id="ga4-id"
                  value={analyticsSettings.ga4MeasurementId}
                  onChange={(e) => updateAnalyticsField('ga4MeasurementId', e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="text-sm"
                  data-testid="input-ga4-id"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in GA4 Admin {'->'} Data Streams
              </p>
              {analyticsSettings.ga4Enabled && hasGa4Id && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 bg-muted">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <SiFacebook className="w-4 h-4 text-[#1877F2] dark:text-[#5AA2FF]" />
                  </div>
                  <CardTitle className="text-base">Facebook Pixel</CardTitle>
                </div>
                <Switch
                  checked={analyticsSettings.facebookPixelEnabled}
                  onCheckedChange={(checked) => updateAnalyticsField('facebookPixelEnabled', checked)}
                  data-testid="switch-fb-pixel-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fb-pixel-id" className="text-sm">Pixel ID</Label>
                <Input
                  id="fb-pixel-id"
                  value={analyticsSettings.facebookPixelId}
                  onChange={(e) => updateAnalyticsField('facebookPixelId', e.target.value)}
                  placeholder="123456789012345"
                  className="text-sm"
                  data-testid="input-fb-pixel-id"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in Meta Events Manager
              </p>
              {analyticsSettings.facebookPixelEnabled && hasFacebookPixelId && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-muted p-6 rounded-lg space-y-4 transition-all">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          Tracked Events
        </h2>
        <div className="p-4 bg-card/60 rounded-lg">
          <p className="text-xs text-muted-foreground mb-3">
            When enabled, the following events are automatically tracked:
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { event: 'cta_click', desc: 'Button clicks (Book Now, etc.)' },
              { event: 'add_to_cart', desc: 'Service added to cart' },
              { event: 'remove_from_cart', desc: 'Service removed from cart' },
              { event: 'begin_checkout', desc: 'Booking form started' },
              { event: 'purchase', desc: 'Booking confirmed (conversion)' },
              { event: 'view_item_list', desc: 'Services page viewed' },
            ].map(({ event, desc }) => (
              <div key={event} className="text-xs bg-muted/40 p-2 rounded">
                <code className="text-primary font-mono">{event}</code>
                <p className="text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


