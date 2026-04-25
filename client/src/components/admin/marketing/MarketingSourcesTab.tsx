import { useQuery } from '@tanstack/react-query';
import { Info, AlertCircle, BarChart3 } from 'lucide-react';
import { authenticatedRequest } from '@/lib/queryClient';
import { getSourceDisplayName, formatRevenue } from '@/lib/analytics-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DateRange } from '../MarketingSection';

interface Props {
  dateRange: DateRange;
  getAccessToken: () => Promise<string | null>;
}

interface SourceRow {
  source: string;
  visitors: number;
  bookings: number;
  conversionRate: string;
  revenue: string;
  bestCampaign: string | null;
  bestLandingPage: string | null;
}

// Plain-language tooltips for Direct and Unknown (SOURCES-03)
const SOURCE_TOOLTIPS: Record<string, string> = {
  direct:  'Visitors who typed your URL directly, used a bookmark, or came from a non-web source like email client or WhatsApp.',
  unknown: "Source couldn't be identified. This happens when the referrer is missing and no UTM parameters were present.",
};

export function MarketingSourcesTab({ dateRange, getAccessToken }: Props) {
  const { data, isLoading, isError, refetch } = useQuery<SourceRow[]>({
    queryKey: ['/api/analytics/sources', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to:   dateRange.to.toISOString(),
      });
      const res = await authenticatedRequest('GET', `/api/analytics/sources?${params}`, token);
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // --- EMPTY STATE: Loading ---
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }

  // --- EMPTY STATE: Error ---
  if (isError) {
    return (
      <Card className="border border-border/60">
        <CardContent className="p-10 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="font-semibold mb-1">Could not load sources data</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // --- EMPTY STATE: No data yet (all zeros) ---
  const hasRealData = data && data.some((r) => r.visitors > 0);
  if (!data || !hasRealData) {
    return (
      <Card className="border border-border/60">
        <CardContent className="p-10 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No source data yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Once visitors arrive, you'll see a breakdown by source here — showing which channels
            drive the most traffic and bookings.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Direct and Unknown sources will always appear once tracking is active.
          </p>
        </CardContent>
      </Card>
    );
  }

  // --- DATA VIEW: Sources table (SOURCES-01, SOURCES-02, SOURCES-03, SOURCES-04) ---
  return (
    <TooltipProvider>
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Performance by Source</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sorted by visitors. Direct and Unknown are always shown.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium text-xs">Source</th>
                  <th className="text-right py-2 pr-4 font-medium text-xs">Visitors</th>
                  <th className="text-right py-2 pr-4 font-medium text-xs">Bookings</th>
                  <th className="text-right py-2 pr-4 font-medium text-xs">Conv. Rate</th>
                  <th className="text-right py-2 pr-4 font-medium text-xs">Revenue</th>
                  <th className="text-left py-2 pr-4 font-medium text-xs">Top Campaign</th>
                  <th className="text-left py-2 font-medium text-xs">Top Landing Page</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const tooltip = SOURCE_TOOLTIPS[row.source];
                  return (
                    <tr key={row.source} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4 font-medium">
                        <span className="flex items-center gap-1">
                          {getSourceDisplayName(row.source)}
                          {tooltip && (
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
                            </UITooltip>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.visitors.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.bookings.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.conversionRate}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatRevenue(row.revenue)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.bestCampaign ?? '—'}</td>
                      <td className="py-2 text-muted-foreground text-xs truncate max-w-[180px]">{row.bestLandingPage ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
