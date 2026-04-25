import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Users, Calendar, TrendingUp, DollarSign, BarChart3, MousePointerClick, AlertCircle } from 'lucide-react';
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

interface TrendPoint { date: string; visitors: number; bookings: number; }
interface RecentConversion {
  id: number; eventType: string; source: string | null; campaign: string | null;
  bookingValue: string | null; occurredAt: string; bookingId: number | null;
}
interface OverviewData {
  visitors: number; bookings: number; conversionRate: string; revenue: string;
  topSource: string | null; topCampaign: string | null; topLandingPage: string | null;
  recentConversions: RecentConversion[]; trend: TrendPoint[];
}

function eventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'booking_completed': return 'Booking completed';
    case 'booking_started':   return 'Booking started';
    case 'chat_initiated':    return 'Chat opened';
    default:                  return eventType;
  }
}

export function MarketingOverviewTab({ dateRange, getAccessToken }: Props) {
  const { data, isLoading, isError, refetch } = useQuery<OverviewData>({
    queryKey: ['/api/analytics/overview', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to:   dateRange.to.toISOString(),
      });
      const res = await authenticatedRequest('GET', `/api/analytics/overview?${params}`, token);
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // --- EMPTY STATE: Loading ---
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  // --- EMPTY STATE: Error ---
  if (isError) {
    return (
      <Card className="border border-border/60">
        <CardContent className="p-10 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="font-semibold mb-1">Could not load marketing data</p>
          <p className="text-sm text-muted-foreground mb-4">Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // --- EMPTY STATE: No data yet (migration not applied OR genuinely no visitors) ---
  if (!data || (data.visitors === 0 && data.bookings === 0 && data.trend.length === 0)) {
    return (
      <Card className="border border-border/60">
        <CardContent className="p-10 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No marketing data yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-3">
            Data collection starts as soon as visitors arrive at your site. Check back after
            your first visitors land on any page with UTM parameters.
          </p>
          <p className="text-xs text-muted-foreground">
            If you recently set up tracking, allow a few minutes for your first session to appear.
          </p>
        </CardContent>
      </Card>
    );
  }

  // --- EMPTY STATE: No data for selected period ---
  if (data.visitors === 0) {
    return (
      <Card className="border border-border/60">
        <CardContent className="p-10 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold mb-1">No data for this period</p>
          <p className="text-sm text-muted-foreground">
            Try a wider date range or check back after more visitors arrive.
          </p>
        </CardContent>
      </Card>
    );
  }

  // --- DATA VIEW ---
  const kpiStats = [
    { label: 'Visitors',        value: data.visitors.toLocaleString(), icon: Users,       color: 'text-blue-500',    bg: 'bg-blue-500/10' },
    { label: 'Bookings',        value: data.bookings.toLocaleString(), icon: Calendar,    color: 'text-violet-500',  bg: 'bg-violet-500/10' },
    { label: 'Conversion Rate', value: data.conversionRate,            icon: TrendingUp,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Revenue',         value: `$${data.revenue}`,             icon: DollarSign,  color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  ];

  const bestOfCards = [
    { label: 'Top Source',       value: data.topSource   ? getSourceDisplayName(data.topSource) : '—', icon: MousePointerClick },
    { label: 'Top Campaign',     value: data.topCampaign ?? '—',                                       icon: BarChart3 },
    { label: 'Top Landing Page', value: data.topLandingPage ?? '—',                                    icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards — 2x2 mobile, 4-col desktop */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpiStats.map((stat) => (
          <Card key={stat.label} className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">{stat.label}</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{stat.value}</p>
                </div>
                <div className={clsx('w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0', stat.bg)}>
                  <stat.icon className={clsx('w-5 h-5 sm:w-6 sm:h-6', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Best-of cards — Top Source, Top Campaign, Top Landing Page */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {bestOfCards.map((card) => (
          <Card key={card.label} className="border border-border/60 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              <p className="font-semibold truncate text-sm">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend chart — AreaChart, Visitors=blue (#1C53A3), Bookings=yellow fill (#FFFF01)
          Note on brand yellow: #FFFF01 is near-invisible as a stroke on white backgrounds (pitfall 6).
          Using stroke="#CA8A04" (amber-600, visible) while keeping fill="#FFFF01" for the area fill.
          This is intentional per pitfall 6 guidance. */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Visitors &amp; Bookings Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {/* #1C53A3 = Primary Blue */}
              <Area type="monotone" dataKey="visitors" stroke="#1C53A3" fill="#1C53A3" fillOpacity={0.15} name="Visitors" />
              {/* #FFFF01 = Brand Yellow — only on chart fill, not text on white bg */}
              <Area type="monotone" dataKey="bookings" stroke="#CA8A04" fill="#FFFF01" fillOpacity={0.4} name="Bookings" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent conversions — last 5 events */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Conversions</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentConversions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No conversions yet for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium text-xs">What happened</th>
                    <th className="text-left py-2 pr-4 font-medium text-xs">Source</th>
                    <th className="text-left py-2 pr-4 font-medium text-xs">Campaign</th>
                    <th className="text-right py-2 pr-4 font-medium text-xs">Value</th>
                    <th className="text-right py-2 font-medium text-xs">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentConversions.map((conv) => (
                    <tr key={conv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4">{eventTypeLabel(conv.eventType)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{getSourceDisplayName(conv.source)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{conv.campaign ?? '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {conv.bookingValue ? formatRevenue(conv.bookingValue) : '—'}
                      </td>
                      <td className="py-2 text-right text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(conv.occurredAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
