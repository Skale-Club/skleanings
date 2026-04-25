import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { authenticatedRequest } from '@/lib/queryClient';
import { getSourceDisplayName, formatRevenue } from '@/lib/analytics-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { DateRange } from '../MarketingSection';

interface Props {
  dateRange: DateRange;
  getAccessToken: () => Promise<string | null>;
}

interface CampaignRow {
  campaign: string;
  source: string | null;
  medium: string | null;
  visitors: number;
  bookings: number;
  conversionRate: string;
  revenue: string;
  topLandingPage: string | null;
}

export function MarketingCampaignsTab({ dateRange, getAccessToken }: Props) {
  const { data, isLoading, isError, refetch } = useQuery<CampaignRow[]>({
    queryKey: ['/api/analytics/campaigns', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to:   dateRange.to.toISOString(),
      });
      const res = await authenticatedRequest('GET', `/api/analytics/campaigns?${params}`, token);
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
          <p className="font-semibold mb-1">Could not load campaigns data</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // --- EMPTY STATE: No data yet ---
  if (!data || data.length === 0) {
    return (
      <Card className="border border-border/60">
        <CardContent className="p-10 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No campaign data yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Campaigns appear here when visitors arrive via UTM-tagged links
            (utm_campaign parameter in the URL). Once you run your first campaign,
            you'll see performance data here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // --- DATA VIEW: Campaigns table (CAMP-01, CAMP-02, CAMP-03, CAMP-04) ---
  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Performance by Campaign</CardTitle>
        {/* CAMP-02: Subtitle explaining zero-booking rows */}
        <p className="text-xs text-muted-foreground">
          Showing all campaigns. "No bookings yet" means visitors arrived but didn't book.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium text-xs">Campaign</th>
                <th className="text-left py-2 pr-4 font-medium text-xs">Source</th>
                <th className="text-left py-2 pr-4 font-medium text-xs">Medium</th>
                <th className="text-right py-2 pr-4 font-medium text-xs">Visitors</th>
                <th className="text-right py-2 pr-4 font-medium text-xs">Bookings</th>
                <th className="text-right py-2 pr-4 font-medium text-xs">Conv. Rate</th>
                <th className="text-right py-2 pr-4 font-medium text-xs">Revenue</th>
                <th className="text-left py-2 font-medium text-xs">Top Landing Page</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr
                  key={`${row.campaign}|${row.source ?? ''}|${row.medium ?? ''}|${idx}`}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-2 pr-4 font-medium">{row.campaign}</td>
                  {/* SOURCES-04: business-friendly source names */}
                  <td className="py-2 pr-4 text-muted-foreground">{getSourceDisplayName(row.source)}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{row.medium ?? '—'}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.visitors.toLocaleString()}</td>
                  {/* CAMP-02: "No bookings yet" for zero-booking campaigns */}
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {row.bookings === 0
                      ? <span className="text-muted-foreground text-xs">No bookings yet</span>
                      : row.bookings.toLocaleString()
                    }
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.conversionRate}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatRevenue(row.revenue)}</td>
                  {/* CAMP-03: Top landing page */}
                  <td className="py-2 text-muted-foreground text-xs truncate max-w-[180px]">{row.topLandingPage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
