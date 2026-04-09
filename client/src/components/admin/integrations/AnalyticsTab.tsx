import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SiFacebook, SiGoogleanalytics, SiGoogletagmanager } from 'react-icons/si';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { AnalyticsSettings } from '@/components/admin/shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Check, LayoutGrid } from 'lucide-react';
import type { IntegrationTabProps } from './types';

export function AnalyticsTab({ getAccessToken }: IntegrationTabProps) {
  const { toast } = useToast();
  const [analyticsSettings, setAnalyticsSettings] = useState<AnalyticsSettings>({
    gtmContainerId: '', ga4MeasurementId: '', facebookPixelId: '',
    gtmEnabled: false, ga4Enabled: false, facebookPixelEnabled: false,
  });
  const [isSavingAnalytics, setIsSavingAnalytics] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: companySettings } = useQuery<any>({ queryKey: ['/api/company-settings'] });

  useEffect(() => {
    if (companySettings) {
      setAnalyticsSettings({
        gtmContainerId: companySettings.gtmContainerId || '',
        ga4MeasurementId: companySettings.ga4MeasurementId || '',
        facebookPixelId: companySettings.facebookPixelId || '',
        gtmEnabled: companySettings.gtmEnabled || false,
        ga4Enabled: companySettings.ga4Enabled || false,
        facebookPixelEnabled: companySettings.facebookPixelEnabled || false,
      });
    }
  }, [companySettings]);

  useEffect(() => { return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }; }, []);

  const saveAnalyticsSettings = useCallback(async (newSettings: Partial<AnalyticsSettings>) => {
    setIsSavingAnalytics(true);
    try {
      let token = await getAccessToken();
      if (!token) { await new Promise(r => setTimeout(r, 150)); token = await getAccessToken(); }
      if (!token) throw new Error('Authentication required');
      await authenticatedRequest('PUT', '/api/company-settings', token, newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    } catch (error: any) {
      toast({ title: 'Error saving analytics settings', description: error.message, variant: 'destructive' });
    } finally { setIsSavingAnalytics(false); }
  }, [getAccessToken, toast]);

  const updateAnalyticsField = useCallback(<K extends keyof AnalyticsSettings>(field: K, value: AnalyticsSettings[K]) => {
    setAnalyticsSettings(prev => {
      const next = { ...prev, [field]: value };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => { saveAnalyticsSettings(next); }, 800);
      return next;
    });
  }, [saveAnalyticsSettings]);

  const hasGtmId = analyticsSettings.gtmContainerId.trim().length > 0;
  const hasGa4Id = analyticsSettings.ga4MeasurementId.trim().length > 0;
  const hasFbPixelId = analyticsSettings.facebookPixelId.trim().length > 0;

  const ActiveBadge = () => (
    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
      <Check className="h-3.5 w-3.5" /><span className="font-medium">Integration Active</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {/* GTM */}
        <Card className="border-0 bg-muted">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <SiGoogletagmanager className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                </div>
                <CardTitle className="text-base">Google Tag Manager</CardTitle>
              </div>
              <Switch checked={analyticsSettings.gtmEnabled} onCheckedChange={(c) => updateAnalyticsField('gtmEnabled', c)} data-testid="switch-gtm-enabled" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="gtm-id" className="text-sm">Container ID</Label>
              <Input id="gtm-id" value={analyticsSettings.gtmContainerId}
                onChange={(e) => updateAnalyticsField('gtmContainerId', e.target.value)}
                placeholder="GTM-XXXXXXX" className="text-sm" data-testid="input-gtm-id" />
            </div>
            <p className="text-xs text-muted-foreground">Find this in GTM under Admin → Container Settings</p>
            {analyticsSettings.gtmEnabled && hasGtmId && <ActiveBadge />}
          </CardContent>
        </Card>

        {/* GA4 */}
        <Card className="border-0 bg-muted">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <SiGoogleanalytics className="w-4 h-4 text-[#E37400] dark:text-[#FFB74D]" />
                </div>
                <CardTitle className="text-base">Google Analytics 4</CardTitle>
              </div>
              <Switch checked={analyticsSettings.ga4Enabled} onCheckedChange={(c) => updateAnalyticsField('ga4Enabled', c)} data-testid="switch-ga4-enabled" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ga4-id" className="text-sm">Measurement ID</Label>
              <Input id="ga4-id" value={analyticsSettings.ga4MeasurementId}
                onChange={(e) => updateAnalyticsField('ga4MeasurementId', e.target.value)}
                placeholder="G-XXXXXXXXXX" className="text-sm" data-testid="input-ga4-id" />
            </div>
            <p className="text-xs text-muted-foreground">Find this in GA4 Admin → Data Streams</p>
            {analyticsSettings.ga4Enabled && hasGa4Id && <ActiveBadge />}
          </CardContent>
        </Card>

        {/* Facebook Pixel */}
        <Card className="border-0 bg-muted">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <SiFacebook className="w-4 h-4 text-[#1877F2] dark:text-[#5AA2FF]" />
                </div>
                <CardTitle className="text-base">Facebook Pixel</CardTitle>
              </div>
              <Switch checked={analyticsSettings.facebookPixelEnabled} onCheckedChange={(c) => updateAnalyticsField('facebookPixelEnabled', c)} data-testid="switch-fb-pixel-enabled" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="fb-pixel-id" className="text-sm">Pixel ID</Label>
              <Input id="fb-pixel-id" value={analyticsSettings.facebookPixelId}
                onChange={(e) => updateAnalyticsField('facebookPixelId', e.target.value)}
                placeholder="123456789012345" className="text-sm" data-testid="input-fb-pixel-id" />
            </div>
            <p className="text-xs text-muted-foreground">Find this in Meta Events Manager</p>
            {analyticsSettings.facebookPixelEnabled && hasFbPixelId && <ActiveBadge />}
          </CardContent>
        </Card>
      </div>

      {/* Tracked Events */}
      <div className="bg-muted p-6 rounded-lg space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          Tracked Events
        </h2>
        <div className="p-4 bg-card/60 rounded-lg">
          <p className="text-xs text-muted-foreground mb-3">When enabled, the following events are automatically tracked:</p>
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

      {isSavingAnalytics && <p className="text-xs text-muted-foreground text-right">Saving...</p>}
    </div>
  );
}
