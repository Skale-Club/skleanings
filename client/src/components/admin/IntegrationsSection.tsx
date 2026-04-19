import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, CreditCard, Calendar, BarChart2, MessageSquare, Zap } from 'lucide-react';
import { AITab } from './integrations/AITab';
import { GHLTab } from './integrations/GHLTab';
import { StripeTab } from './integrations/StripeTab';
import { CalendarTab } from './integrations/CalendarTab';
import { AnalyticsTab } from './integrations/AnalyticsTab';
import { MessagingTab } from './integrations/MessagingTab';
import { useSlugTab } from '@/hooks/use-slug-tab';

const INTEGRATION_TABS = ['ai', 'ghl', 'stripe', 'calendar', 'analytics', 'messaging'] as const;

export function IntegrationsSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const [activeTab, setActiveTab] = useSlugTab('/admin/integrations', 'ai', INTEGRATION_TABS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Connect your booking system with external services</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="ai" className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> AI
          </TabsTrigger>
          <TabsTrigger value="ghl" className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> GoHighLevel
          </TabsTrigger>
          <TabsTrigger value="stripe" className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Stripe
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Calendar
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="messaging" className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Messaging
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-6"><AITab getAccessToken={getAccessToken} /></TabsContent>
        <TabsContent value="ghl" className="mt-6"><GHLTab getAccessToken={getAccessToken} /></TabsContent>
        <TabsContent value="stripe" className="mt-6"><StripeTab getAccessToken={getAccessToken} /></TabsContent>
        <TabsContent value="calendar" className="mt-6"><CalendarTab getAccessToken={getAccessToken} /></TabsContent>
        <TabsContent value="analytics" className="mt-6"><AnalyticsTab getAccessToken={getAccessToken} /></TabsContent>
        <TabsContent value="messaging" className="mt-6"><MessagingTab getAccessToken={getAccessToken} /></TabsContent>
      </Tabs>
    </div>
  );
}
