import { useState, useMemo, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  addDays,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Booking, StaffMember } from '@shared/schema';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

const STAFF_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

function getStaffColor(staffId: number | null | undefined): string {
  if (!staffId) return '#6B7280';
  return STAFF_COLORS[staffId % STAFF_COLORS.length];
}

interface CalendarEvent {
  bookingId: number;
  title: string;
  start: Date;
  end: Date;
  status: string;
  staffMemberId: number | null;
  color: string;
  isGcalBusy?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#FEF3C7',
  confirmed: '#D1FAE5',
  completed: '#DBEAFE',
  cancelled: '#FEE2E2',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  pending: '#92400E',
  confirmed: '#065F46',
  completed: '#1E40AF',
  cancelled: '#991B1B',
};

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

function EventComponent({ event }: { event: CalendarEvent }) {
  if (event.isGcalBusy) {
    return <div style={{ fontSize: 11, padding: '0 4px', color: '#9CA3AF' }}>Busy</div>;
  }
  const bg = STATUS_COLORS[event.status] ?? '#F3F4F6';
  const color = STATUS_TEXT_COLORS[event.status] ?? '#374151';
  return (
    <div style={{ fontSize: 11, padding: '1px 4px', overflow: 'hidden' }}>
      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {event.title}
      </div>
      <span style={{ background: bg, color, borderRadius: 4, padding: '0 4px', fontSize: 10 }}>
        {event.status}
      </span>
    </div>
  );
}

export function AppointmentsCalendarSection({
  getAccessToken,
  staffMemberId: filterStaffMemberId,
}: {
  getAccessToken: () => Promise<string | null>;
  staffMemberId?: number | null;
}) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<string>(Views.MONTH);
  const [hiddenStaff, setHiddenStaff] = useState<Set<number>>(new Set());
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());

  // Click state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newBookingSlot, setNewBookingSlot] = useState<{ date: string; startTime: string; staffMemberId?: number } | null>(null);

  // GCal overlay state
  const [gcalBusy, setGcalBusy] = useState<CalendarEvent[]>([]);

  // Compute visible date range
  const { from, to } = useMemo(() => {
    let start: Date;
    let end: Date;
    if (currentView === Views.MONTH) {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    } else if (currentView === Views.WEEK) {
      start = startOfWeek(currentDate, { weekStartsOn: 0 });
      end = endOfWeek(currentDate, { weekStartsOn: 0 });
    } else {
      start = currentDate;
      end = currentDate;
    }
    return {
      from: format(start, 'yyyy-MM-dd'),
      to: format(end, 'yyyy-MM-dd'),
    };
  }, [currentDate, currentView]);

  // Fetch bookings for visible range
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/bookings', 'range', from, to],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/bookings?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch all staff
  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ['/api/staff', 'all'],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch('/api/staff?includeInactive=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Convert bookings to calendar events, apply filters
  const events: CalendarEvent[] = useMemo(() => {
    return bookings
      .filter(b => {
        // Staff-scoped filter: if filterStaffMemberId set, only show that staff's bookings
        if (filterStaffMemberId !== null && filterStaffMemberId !== undefined) {
          if (b.staffMemberId !== filterStaffMemberId) return false;
        }
        if (b.staffMemberId && hiddenStaff.has(b.staffMemberId)) return false;
        if (hiddenStatuses.has(b.status)) return false;
        return true;
      })
      .map(b => ({
        bookingId: b.id,
        title: b.customerName,
        start: new Date(`${b.bookingDate}T${b.startTime}:00`),
        end: new Date(`${b.bookingDate}T${b.endTime}:00`),
        status: b.status,
        staffMemberId: b.staffMemberId ?? null,
        color: getStaffColor(b.staffMemberId),
      }));
  }, [bookings, hiddenStaff, hiddenStatuses]);

  // GCal overlay — async, non-blocking, best-effort
  useEffect(() => {
    if (!staffList.length) return;
    let cancelled = false;

    async function fetchBusy() {
      const token = await getAccessToken();
      if (!token) return;
      const results: CalendarEvent[] = [];

      // Build list of all dates in range
      const dates: string[] = [];
      let d = new Date(from + 'T00:00:00');
      const end = new Date(to + 'T00:00:00');
      while (d <= end) {
        dates.push(format(d, 'yyyy-MM-dd'));
        d = addDays(d, 1);
      }

      await Promise.all(
        staffList
          .filter(s => !hiddenStaff.has(s.id))
          .map(async staff => {
            await Promise.all(
              dates.map(async date => {
                try {
                  const res = await fetch(
                    `/api/staff/${staff.id}/calendar/busy?date=${date}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  if (!res.ok) return;
                  const data = await res.json() as { busyTimes: { start: string; end: string }[] };
                  (data.busyTimes ?? []).forEach(({ start, end: endTime }) => {
                    results.push({
                      bookingId: -1,
                      title: `${staff.firstName} — busy`,
                      start: new Date(`${date}T${start}:00`),
                      end: new Date(`${date}T${endTime}:00`),
                      status: 'gcal',
                      staffMemberId: staff.id,
                      color: '#E5E7EB',
                      isGcalBusy: true,
                    });
                  });
                } catch {
                  // silently ignore — overlay is best-effort
                }
              })
            );
          })
      );

      if (!cancelled) setGcalBusy(results);
    }

    fetchBusy();
    return () => { cancelled = true; };
  }, [from, to, staffList, hiddenStaff, getAccessToken]);

  // Combined events: bookings + gcal overlay
  const allEvents = useMemo(() => [...events, ...gcalBusy], [events, gcalBusy]);

  // Click handlers
  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.isGcalBusy) return;
    const booking = bookings.find(b => b.id === event.bookingId);
    if (booking) setSelectedBooking(booking);
  };

  const handleSelectSlot = ({ start }: { start: Date }) => {
    const visibleStaff = staffList.filter(s => !hiddenStaff.has(s.id));
    setNewBookingSlot({
      date: format(start, 'yyyy-MM-dd'),
      startTime: format(start, 'HH:mm'),
      staffMemberId: visibleStaff.length === 1 ? visibleStaff[0].id : undefined,
    });
  };

  const eventStyleGetter = (event: CalendarEvent) => ({
    style: {
      backgroundColor: event.isGcalBusy ? '#F3F4F6' : event.color,
      border: 'none',
      opacity: event.isGcalBusy ? 0.7 : 1,
      cursor: event.isGcalBusy ? 'default' : 'pointer',
      color: event.isGcalBusy ? '#9CA3AF' : '#fff',
      borderRadius: 4,
    },
  });

  const toggleStaff = (id: number) => {
    setHiddenStaff(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStatus = (status: string) => {
    setHiddenStatuses(prev => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
        <p className="text-sm text-muted-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border text-sm">
        {/* Staff filters */}
        {staffList.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center">
            <span className="font-medium text-muted-foreground">Staff:</span>
            {staffList.map(staff => (
              <label key={staff.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!hiddenStaff.has(staff.id)}
                  onChange={() => toggleStaff(staff.id)}
                  className="rounded"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: getStaffColor(staff.id) }}
                />
                <span>{staff.firstName} {staff.lastName}</span>
              </label>
            ))}
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block flex-shrink-0" />
              <span className="text-muted-foreground">Unassigned</span>
            </label>
          </div>
        )}

        {/* Divider */}
        {staffList.length > 0 && <div className="w-px bg-border self-stretch" />}

        {/* Status filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="font-medium text-muted-foreground">Status:</span>
          {STATUSES.map(status => (
            <label key={status} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!hiddenStatuses.has(status)}
                onChange={() => toggleStatus(status)}
                className="rounded"
              />
              <span
                className="px-1.5 py-0.5 rounded text-xs font-medium capitalize"
                style={{
                  background: STATUS_COLORS[status],
                  color: STATUS_TEXT_COLORS[status],
                }}
              >
                {status}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card rounded-lg border p-4" style={{ height: 680 }}>
        <Calendar
          localizer={localizer}
          events={allEvents}
          date={currentDate}
          view={currentView as any}
          onNavigate={setCurrentDate}
          onView={setCurrentView}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          eventPropGetter={eventStyleGetter}
          components={{ event: EventComponent as any }}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          style={{ height: '100%' }}
          popup
        />
      </div>

      {/* Booking detail dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{selectedBooking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{selectedBooking.customerPhone}</span>
              </div>
              {selectedBooking.customerEmail && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{selectedBooking.customerEmail}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{selectedBooking.bookingDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span>{selectedBooking.startTime} – {selectedBooking.endTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  style={{
                    background: STATUS_COLORS[selectedBooking.status],
                    color: STATUS_TEXT_COLORS[selectedBooking.status],
                    border: 'none',
                  }}
                >
                  {selectedBooking.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">${selectedBooking.totalPrice}</span>
              </div>
              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    setSelectedBooking(null);
                    setLocation('/admin/bookings');
                  }}
                >
                  Open in Bookings
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New booking slot dialog */}
      <Dialog open={!!newBookingSlot} onOpenChange={() => setNewBookingSlot(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Booking</DialogTitle>
          </DialogHeader>
          {newBookingSlot && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{newBookingSlot.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start time</span>
                <span className="font-medium">{newBookingSlot.startTime}</span>
              </div>
              {newBookingSlot.staffMemberId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staff</span>
                  <span className="font-medium">
                    {staffList.find(s => s.id === newBookingSlot.staffMemberId)?.firstName}
                  </span>
                </div>
              )}
              <p className="text-muted-foreground text-xs pt-1">
                Use the Bookings section to create the full booking with services and pricing.
              </p>
              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    setNewBookingSlot(null);
                    setLocation('/admin/bookings');
                  }}
                >
                  Go to Bookings
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Legend */}
      {staffList.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {staffList.map(staff => (
            <div key={staff.id} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getStaffColor(staff.id) }}
              />
              <span>{staff.firstName} {staff.lastName}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-400" />
            <span>Unassigned</span>
          </div>
        </div>
      )}
    </div>
  );
}
