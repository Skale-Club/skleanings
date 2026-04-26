import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BarChart3, ListOrdered } from 'lucide-react';
import { authenticatedRequest } from '@/lib/queryClient';
import { getSourceDisplayName, formatRevenue } from '@/lib/analytics-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisitorJourneyPanel } from './VisitorJourneyPanel';
import type { DateRange } from '../MarketingSection';

interface ConversionEventRow {
  id: number;
  eventType: string;
  attributedSource: string | null;
  attributedCampaign: string | null;
  attributedLandingPage: string | null;
  bookingValue: string | null;
  occurredAt: string;
  bookingId: number | null;
  visitorId: string | null;
  attributionModel: string;
}

interface Props {
  dateRange: DateRange;
  getAccessToken: () => Promise<string | null>;
}

const EVENT_LABELS: Record<string, string> = {
  booking_completed: 'Booking Completed',
  booking_started:   'Booking Started',
  chat_initiated:    'Chat Initiated',
};

const PAGE_SIZE = 50;

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function MarketingConversionsTab({ dateRange, getAccessToken }: Props) {
  // D-04: Source filter (FILTER-02 — scoped to Conversions tab only)
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  // D-05: Load-more pagination state
  const [offset, setOffset] = useState<number>(0);
  const [allRows, setAllRows] = useState<ConversionEventRow[]>([]);

  // D-06: Journey panel state
  const [selectedEvent, setSelectedEvent] = useState<ConversionEventRow | null>(null);
  const [journeyOpen, setJourneyOpen] = useState<boolean>(false);

  const querySource = sourceFilter === 'all' ? undefined : sourceFilter;

  const { data, isLoading, isError, refetch } = useQuery<ConversionEventRow[]>({
    queryKey: [
      '/api/analytics/conversions',
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
      querySource,
      offset,
    ],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const params = new URLSearchParams({
        from:   dateRange.from.toISOString(),
        to:     dateRange.to.toISOString(),
        limit:  String(PAGE_SIZE),
        offset: String(offset),
      });
      if (querySource) params.set('source', querySource);
      const res = await authenticatedRequest('GET', `/api/analytics/conversions?${params}`, token);
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // React Query v5 removed onSuccess from useQuery — use useEffect for load-more accumulation
  useEffect(() => {
    if (data == null) return;
    if (offset === 0) setAllRows(data);
    else setAllRows((prev) => [...prev, ...data]);
  }, [data, offset]);

  // Reset pagination when filters change
  function handleSourceChange(value: string) {
    setSourceFilter(value);
    setOffset(0);
    setAllRows([]);
  }

  function handleLoadMore() {
    setOffset((prev) => prev + PAGE_SIZE);
  }

  function handleRowClick(event: ConversionEventRow) {
    setSelectedEvent(event);
    setJourneyOpen(true);
  }

  // Derive source options from current data for the filter dropdown
  const sourceOptions = Array.from(
    new Set(allRows.map((r) => r.attributedSource).filter(Boolean) as string[])
  );

  // --- EMPTY STATE: Loading ---
  if (isLoading && allRows.length === 0) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }

  // --- EMPTY STATE: Error ---
  if (isError && allRows.length === 0) {
    return (
      <Card className="border border-border/60">
        <CardContent className="p-10 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="font-semibold mb-1">Could not load conversions data</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // --- EMPTY STATE: No data yet ---
  if (!isLoading && allRows.length === 0) {
    return (
      <>
        {/* Source filter still shown even on empty state (D-04) */}
        <div className="flex items-center gap-3 mb-4">
          <Select value={sourceFilter} onValueChange={handleSourceChange}>
            <SelectTrigger className="h-8 w-[180px] text-xs border bg-background">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sourceOptions.map((s) => (
                <SelectItem key={s} value={s}>{getSourceDisplayName(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card className="border border-border/60">
          <CardContent className="p-10 text-center">
            <ListOrdered className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No conversions yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Conversion events will appear here once visitors complete bookings, start the booking
              flow, or initiate a chat. Each row shows the source that drove the action.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const hasMore = data != null && data.length === PAGE_SIZE;

  // --- DATA VIEW: Conversions table (CONV-01, CONV-02, CONV-03) ---
  return (
    <>
      {/* D-04: Source filter */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={sourceFilter} onValueChange={handleSourceChange}>
          <SelectTrigger className="h-8 w-[180px] text-xs border bg-background">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sourceOptions.map((s) => (
              <SelectItem key={s} value={s}>{getSourceDisplayName(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{allRows.length} events</span>
      </div>

      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Conversion Events</CardTitle>
          <p className="text-xs text-muted-foreground">
            Last-touch attribution only. Click any row to view the full visitor journey.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium text-xs">Event</th>
                  <th className="text-left py-2 pr-4 font-medium text-xs">Source</th>
                  <th className="text-left py-2 pr-4 font-medium text-xs">Campaign</th>
                  <th className="text-left py-2 pr-4 font-medium text-xs hidden lg:table-cell">Landing Page</th>
                  <th className="text-right py-2 pr-4 font-medium text-xs">Value</th>
                  <th className="text-left py-2 pr-4 font-medium text-xs">Time</th>
                  <th className="text-left py-2 font-medium text-xs">Attribution</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleRowClick(row)}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    {/* D-03: Event column — human label */}
                    <td className="py-2 pr-4 font-medium whitespace-nowrap">
                      {EVENT_LABELS[row.eventType] ?? row.eventType}
                    </td>
                    {/* D-03: Source — use getSourceDisplayName */}
                    <td className="py-2 pr-4 text-muted-foreground">
                      {getSourceDisplayName(row.attributedSource)}
                    </td>
                    {/* D-03: Campaign */}
                    <td className="py-2 pr-4 text-muted-foreground">
                      {row.attributedCampaign ?? '—'}
                    </td>
                    {/* D-03: Landing Page — hidden on small screens */}
                    <td className="py-2 pr-4 text-muted-foreground text-xs truncate max-w-[160px] hidden lg:table-cell">
                      {row.attributedLandingPage ?? '—'}
                    </td>
                    {/* D-03: Value — use formatRevenue for booking events, '—' otherwise */}
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.bookingValue ? formatRevenue(row.bookingValue) : '—'}
                    </td>
                    {/* D-03: Time — relative */}
                    <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap text-xs">
                      {formatRelativeTime(row.occurredAt)}
                    </td>
                    {/* D-03: Attribution badge */}
                    <td className="py-2">
                      <Badge variant="secondary" className="text-xs font-medium">
                        Last Touch
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* D-05: Load more button */}
          {hasMore && (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* D-06: Journey slide-over */}
      <VisitorJourneyPanel
        event={selectedEvent}
        open={journeyOpen}
        onClose={() => setJourneyOpen(false)}
        getAccessToken={getAccessToken}
      />
    </>
  );
}
