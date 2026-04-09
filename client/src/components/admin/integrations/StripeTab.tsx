import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SiStripe } from 'react-icons/si';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { IntegrationTabProps } from './types';

interface StripeConnectionStatus {
  connected: boolean;
  stripeUserId?: string;
  webhookSecret?: string;
  isEnabled?: boolean;
}

export function StripeTab({ getAccessToken }: IntegrationTabProps) {
  const { toast } = useToast();
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  const { data: status, isLoading, refetch } = useQuery<StripeConnectionStatus>({
    queryKey: ['/api/integrations/stripe'],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch('/api/integrations/stripe', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch Stripe status');
      return res.json();
    },
  });

  useEffect(() => { if (status?.webhookSecret) setWebhookSecret(status.webhookSecret); }, [status]);

  const disconnect = async () => {
    try {
      const token = await getAccessToken();
      await authenticatedRequest('DELETE', '/api/integrations/stripe/disconnect', token ?? '', {});
      refetch();
      toast({ title: 'Stripe account disconnected' });
    } catch {
      toast({ title: 'Failed to disconnect', variant: 'destructive' });
    }
  };

  const saveWebhook = async () => {
    setIsSavingWebhook(true);
    try {
      const token = await getAccessToken();
      await authenticatedRequest('PUT', '/api/integrations/stripe/webhook', token ?? '', { webhookSecret, isEnabled: status?.isEnabled ?? true });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/stripe'] });
      toast({ title: 'Webhook secret saved' });
    } catch {
      toast({ title: 'Failed to save webhook secret', variant: 'destructive' });
    } finally { setIsSavingWebhook(false); }
  };

  if (isLoading) return null;

  return (
    <Card className="border-0 bg-muted">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <SiStripe className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Stripe</CardTitle>
            <p className="text-sm text-muted-foreground">Accept online payments at checkout</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.connected ? (
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-2">
              <SiStripe className="w-4 h-4 text-violet-500" />
              <span className="font-medium text-sm">Connected</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-mono text-muted-foreground">{status.stripeUserId}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe-webhook-secret">Webhook Secret</Label>
              <Input id="stripe-webhook-secret" type="password" value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)} placeholder="whsec_..." data-testid="input-stripe-webhook-secret" />
              <p className="text-xs text-muted-foreground">
                Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret.
                Subscribe to <code className="bg-background px-1 rounded">checkout.session.completed</code>.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t">
              <Button size="sm" onClick={saveWebhook} disabled={isSavingWebhook} data-testid="button-save-stripe-webhook">
                {isSavingWebhook && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Webhook Secret
              </Button>
              <Button variant="outline" size="sm" onClick={disconnect}
                className="text-destructive hover:text-destructive ml-auto" data-testid="button-disconnect-stripe">
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 space-y-3 text-center">
            <SiStripe className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No Stripe account connected</p>
            <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" data-testid="button-connect-stripe">
              <a href="/api/integrations/stripe/connect">Connect with Stripe</a>
            </Button>
            <p className="text-xs text-muted-foreground">You'll be redirected to Stripe to authorize the connection.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
