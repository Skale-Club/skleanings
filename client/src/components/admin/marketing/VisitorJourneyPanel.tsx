import { useQuery } from '@tanstack/react-query';
import { AlertCircle, MapPin, Clock, TrendingUp } from 'lucide-react';
import { authenticatedRequest } from '@/lib/queryClient';
import { getSourceDisplayName } from '@/lib/analytics-display';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

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

interface VisitorSession {
  id: string;
  firstUtmSource: string | null;
  firstUtmMedium: string | null;
  firstUtmCampaign: string | null;
  firstLandingPage: string | null;
  firstTrafficSource: string;
  firstSeenAt: string;
  lastUtmSource: string | null;
  lastUtmMedium: string | null;
  lastUtmCampaign: string | null;
  lastLandingPage: string | null;
  lastTrafficSource: string;
  lastSeenAt: string;
  visitCount: number;
  totalBookings: number;
  convertedAt: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  booking_completed: 'Booking Completed',
  booking_started:   'Booking Started',
  chat_initiated:    'Chat Initiated',
};

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

interface Props {
  event: ConversionEventRow | null;
  open: boolean;
  onClose: () => void;
  getAccessToken: () => Promise<string | null>;
}

export function VisitorJourneyPanel({ event, open, onClose, getAccessToken }: Props) {
  const visitorId = event?.visitorId ?? null;

  const { data: session, isLoading } = useQuery<VisitorSession | null>({
    queryKey: ['/api/analytics/session', visitorId],
    queryFn: async () => {
      if (!visitorId) return null;
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('GET', `/api/analytics/session/${visitorId}`, token);
      if (res.status === 404) return null;
      return res.json();
    },
    enabled: open && !!visitorId,
    staleTime: 1000 * 60 * 5,
  });

  // D-07: Influence indicator — single-touch vs multi-touch
  function getInfluenceLabel(s: VisitorSession): string {
    const sameSource   = s.firstTrafficSource === s.lastTrafficSource;
    const sameCampaign = (s.firstUtmCampaign ?? '') === (s.lastUtmCampaign ?? '');
    if (sameSource && sameCampaign) return 'Same source — single touch';
    return `Multi-touch: ${getSourceDisplayName(s.firstTrafficSource)} → ${getSourceDisplayName(s.lastTrafficSource)}`;
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Visitor Journey
          </SheetTitle>
        </SheetHeader>

        {!event && (
          <p className="text-muted-foreground text-sm">No event selected.</p>
        )}

        {event && (
          <div className="space-y-6">
            {/* D-08: null visitorId → no session message */}
            {!visitorId && (
              <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 inline mr-2 text-amber-500" />
                No session data available for this event. Attribution was not captured for this conversion.
              </div>
            )}

            {visitorId && isLoading && (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            )}

            {visitorId && !isLoading && !session && (
              <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 inline mr-2 text-amber-500" />
                No session data available for this event. Attribution was not captured for this conversion.
              </div>
            )}

            {visitorId && !isLoading && session && (
              <>
                {/* Influence indicator — D-07 */}
                <div className="rounded-lg bg-muted/50 border border-border/60 p-3 text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                  {getInfluenceLabel(session)}
                </div>

                {/* First-touch block */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    First Touch
                  </h3>
                  <div className="space-y-2 text-sm">
                    <JourneyRow label="Source"        value={getSourceDisplayName(session.firstTrafficSource)} />
                    <JourneyRow label="UTM Source"    value={session.firstUtmSource} />
                    <JourneyRow label="Campaign"      value={session.firstUtmCampaign} />
                    <JourneyRow label="Medium"        value={session.firstUtmMedium} />
                    <JourneyRow label="Landing Page"  value={session.firstLandingPage} truncate />
                    <JourneyRow label="First Seen"    value={formatRelativeTime(session.firstSeenAt)} />
                  </div>
                </section>

                {/* Last-touch block */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Last Touch
                  </h3>
                  <div className="space-y-2 text-sm">
                    <JourneyRow label="Source"        value={getSourceDisplayName(session.lastTrafficSource)} />
                    <JourneyRow label="UTM Source"    value={session.lastUtmSource} />
                    <JourneyRow label="Campaign"      value={session.lastUtmCampaign} />
                    <JourneyRow label="Medium"        value={session.lastUtmMedium} />
                    <JourneyRow label="Landing Page"  value={session.lastLandingPage} truncate />
                    <JourneyRow label="Last Seen"     value={formatRelativeTime(session.lastSeenAt)} />
                  </div>
                </section>

                {/* Session stats */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Session Stats
                  </h3>
                  <div className="space-y-2 text-sm">
                    <JourneyRow label="Total Visits"   value={String(session.visitCount)} />
                    <JourneyRow label="Total Bookings" value={String(session.totalBookings)} />
                    {session.convertedAt && (
                      <JourneyRow label="Converted"    value={formatRelativeTime(session.convertedAt)} />
                    )}
                  </div>
                </section>
              </>
            )}

            {/* Conversion event at bottom — always shown when event is present */}
            <section className="border-t pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Conversion Event
              </h3>
              <div className="space-y-2 text-sm">
                <JourneyRow label="Type"       value={EVENT_LABELS[event.eventType] ?? event.eventType} />
                <JourneyRow label="Time"       value={formatRelativeTime(event.occurredAt)} />
                {event.bookingValue && (
                  <JourneyRow label="Value"    value={`$${parseFloat(event.bookingValue).toFixed(2)}`} />
                )}
                {event.bookingId && (
                  <div className="flex items-start justify-between py-1 gap-4">
                    <span className="text-muted-foreground shrink-0">Booking</span>
                    <a
                      href="/admin?section=bookings"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={(e) => { e.preventDefault(); onClose(); window.location.href = '/admin?section=bookings'; }}
                    >
                      #{event.bookingId}
                    </a>
                  </div>
                )}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Attribution</span>
                  <Badge variant="secondary" className="text-xs font-medium">
                    Last Touch
                  </Badge>
                </div>
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Internal helper — labeled row in journey panel
function JourneyRow({ label, value, truncate }: { label: string; value: string | null | undefined; truncate?: boolean }) {
  return (
    <div className="flex items-start justify-between py-1 gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium text-right ${truncate ? 'truncate max-w-[220px]' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}
