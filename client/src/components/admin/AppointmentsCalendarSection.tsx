import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Users2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useCompanySettings } from '@/context/CompanySettingsContext';
import { apiRequest, authenticatedRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import type { Booking, Service, StaffMember } from '@shared/schema';
import { QuickBookModal } from './QuickBookModal';

const bookingFormSchema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  customerPhone: z.string().min(7, 'Phone is required'),
  customerEmail: z
    .string()
    .email('Invalid email')
    .optional()
    .or(z.literal('')),
  customerAddress: z.string().optional().or(z.literal('')),
  bookingDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  staffMemberId: z.number().nullable().optional(),
  services: z.array(
    z.object({
      serviceId: z.number({ invalid_type_error: 'Select a service' }).int().positive(),
      quantity: z.number().int().min(1).default(1),
    })
  ).min(1),
  customerNotes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

const STAFF_COLORS = [
  '#2563EB',
  '#059669',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#DB2777',
  '#0891B2',
  '#65A30D',
];

const STATUS_SURFACES: Record<string, string> = {
  pending: '#FEF3C7',
  confirmed: '#D1FAE5',
  completed: '#DBEAFE',
  cancelled: '#FEE2E2',
};

const STATUS_ACCENTS: Record<string, string> = {
  pending: '#B45309',
  confirmed: '#047857',
  completed: '#2563EB',
  cancelled: '#B91C1C',
};

const VIEW_LABELS: Record<string, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  'by-staff': 'By Staff',
};

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const DEFAULT_CALENDAR_VIEW = Views.WEEK;
const DEFAULT_SCROLL_TIME = new Date(1970, 0, 1, 8, 0, 0);

const DnDCalendar = withDragAndDrop(Calendar);

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

function getStaffColor(staffId: number | null | undefined): string {
  if (!staffId) return '#64748B';
  return STAFF_COLORS[staffId % STAFF_COLORS.length];
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const normalized = sanitized.length === 3
    ? sanitized.split('').map((char) => char + char).join('')
    : sanitized;
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function addMinutesToHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function CalendarToolbar({
  label,
  onNavigate,
  onView,
  view,
  views,
  filterControl,
  isByStaff,
  onByStaff,
}: {
  label: string;
  onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void;
  onView: (view: string) => void;
  view: string;
  views: string[];
  filterControl?: ReactNode;
  isByStaff?: boolean;
  onByStaff?: (active: boolean) => void;
}) {
  return (
    <div className="appointments-calendar-toolbar">
      <div className="appointments-calendar-toolbar__title">
        <span className="appointments-calendar-toolbar__eyebrow">Schedule View</span>
        <div className="appointments-calendar-toolbar__headline">
          <div className="appointments-calendar-toolbar__month-nav">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-full p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onNavigate('PREV')}
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="appointments-calendar-toolbar__label">{label}</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-full p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onNavigate('NEXT')}
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="appointments-calendar-toolbar__controls">
        {filterControl}
        <div className="appointments-calendar-toolbar__views">
          {views.map((calendarView) => (
            <button
              key={calendarView}
              type="button"
              className={cn(
                'appointments-calendar-toolbar__view-btn',
                view === calendarView && 'appointments-calendar-toolbar__view-btn--active',
              )}
              onClick={() => onView(calendarView)}
            >
              {VIEW_LABELS[calendarView] ?? calendarView}
            </button>
          ))}
          {onByStaff && (
            <button
              type="button"
              onClick={() => onByStaff(!isByStaff)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                isByStaff
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Users2 className="h-3.5 w-3.5" />
              By Staff
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-full border border-border/70 bg-background/80 px-4 text-sm font-medium"
          onClick={() => onNavigate('TODAY')}
        >
          Today
        </Button>
      </div>
    </div>
  );
}

function EventComponent({ event }: { event: CalendarEvent }) {
  const timeLabel = `${format(event.start, 'h:mm a')} - ${format(event.end, 'h:mm a')}`;

  if (event.isGcalBusy) {
    return (
      <div className="appointments-event appointments-event--busy">
        <div className="appointments-event__title">Busy block</div>
        <div className="appointments-event__meta">{timeLabel}</div>
      </div>
    );
  }

  return (
    <div className="appointments-event">
      <div className="appointments-event__title">{event.title}</div>
      <div className="appointments-event__meta">
        <span>{timeLabel}</span>
        <span className="appointments-event__status">{event.status}</span>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  toneClassName,
}: {
  icon: any;
  label: string;
  value: string;
  toneClassName: string;
}) {
  return (
    <Card className="h-full border-border/60 bg-card/50 shadow-sm transition-colors hover:bg-card">
      <CardContent className="flex h-full items-center gap-3 p-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', toneClassName)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.11em] text-muted-foreground/80">
            {label}
          </p>
          <p className="mt-0.5 text-lg font-bold leading-none text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterPill({
  label,
  active,
  accentColor,
  surfaceColor,
  onClick,
}: {
  label: string;
  active: boolean;
  accentColor: string;
  surfaceColor?: string;
  onClick: () => void;
}) {
  const pastelSurface = surfaceColor ?? hexToRgba(accentColor, 0.12);
  const activeStyles: CSSProperties = {
    backgroundColor: pastelSurface,
    borderColor: hexToRgba(accentColor, 0.24),
    color: accentColor,
    boxShadow: `inset 0 0 0 1px ${hexToRgba(accentColor, 0.05)}`,
  };

  const inactiveStyles: CSSProperties = {
    backgroundColor: 'hsl(var(--muted) / 0.55)',
    borderColor: 'hsl(var(--border) / 0.85)',
    color: 'hsl(var(--muted-foreground))',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-all',
        'hover:-translate-y-px',
      )}
      style={active ? activeStyles : inactiveStyles}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: accentColor,
          boxShadow: `0 0 0 4px ${hexToRgba(accentColor, active ? 0.14 : 0.08)}`,
        }}
      />
      <span className="capitalize">{label}</span>
    </button>
  );
}

export function AppointmentsCalendarSection({
  getAccessToken,
  staffMemberId: filterStaffMemberId,
}: {
  getAccessToken: () => Promise<string | null>;
  staffMemberId?: number | null;
}) {
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<string>(DEFAULT_CALENDAR_VIEW);
  const [isByStaff, setIsByStaff] = useState(false);
  const [hiddenStaff, setHiddenStaff] = useState<Set<number>>(new Set());
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newBookingSlot, setNewBookingSlot] = useState<{
    date: string;
    startTime: string;
    staffMemberId?: number;
    isQuickBook?: boolean;
  } | null>(null);
  const [gcalBusy, setGcalBusy] = useState<CalendarEvent[]>([]);

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
    refetchInterval: 30_000,  // D-14: 30-second polling for receptionist workflow
  });

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

  const scopedStaffList = useMemo(
    () => staffList.filter((staff) => (
      filterStaffMemberId === null || filterStaffMemberId === undefined
        ? true
        : staff.id === filterStaffMemberId
    )),
    [filterStaffMemberId, staffList],
  );

  const staffFiltersVisible = filterStaffMemberId === null || filterStaffMemberId === undefined;

  const events: CalendarEvent[] = useMemo(() => (
    bookings
      .filter((booking) => {
        if (filterStaffMemberId !== null && filterStaffMemberId !== undefined) {
          if (booking.staffMemberId !== filterStaffMemberId) return false;
        }
        if (booking.staffMemberId && hiddenStaff.has(booking.staffMemberId)) return false;
        if (hiddenStatuses.has(booking.status)) return false;
        return true;
      })
      .map((booking) => ({
        bookingId: booking.id,
        title: booking.customerName,
        start: new Date(`${booking.bookingDate}T${booking.startTime}:00`),
        end: new Date(`${booking.bookingDate}T${booking.endTime}:00`),
        status: booking.status,
        staffMemberId: booking.staffMemberId ?? null,
        color: getStaffColor(booking.staffMemberId),
      }))
  ), [bookings, filterStaffMemberId, hiddenStaff, hiddenStatuses]);

  useEffect(() => {
    if (!scopedStaffList.length) {
      setGcalBusy([]);
      return;
    }

    let cancelled = false;

    async function fetchBusy() {
      const token = await getAccessToken();
      if (!token) return;

      const results: CalendarEvent[] = [];
      const dates: string[] = [];
      let cursor = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T00:00:00`);

      while (cursor <= end) {
        dates.push(format(cursor, 'yyyy-MM-dd'));
        cursor = addDays(cursor, 1);
      }

      await Promise.all(
        scopedStaffList
          .filter((staff) => !hiddenStaff.has(staff.id))
          .map(async (staff) => {
            await Promise.all(
              dates.map(async (date) => {
                try {
                  const res = await fetch(`/api/staff/${staff.id}/calendar/busy?date=${date}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!res.ok) return;

                  const data = await res.json() as {
                    busyTimes: { start: string; end: string }[];
                  };

                  (data.busyTimes ?? []).forEach(({ start, end: endTime }) => {
                    results.push({
                      bookingId: -1,
                      title: `${staff.firstName} busy`,
                      start: new Date(`${date}T${start}:00`),
                      end: new Date(`${date}T${endTime}:00`),
                      status: 'gcal',
                      staffMemberId: staff.id,
                      color: '#94A3B8',
                      isGcalBusy: true,
                    });
                  });
                } catch {
                  // GCal overlay remains best-effort and should never block the calendar.
                }
              }),
            );
          }),
      );

      if (!cancelled) {
        setGcalBusy(results);
      }
    }

    fetchBusy();
    return () => {
      cancelled = true;
    };
  }, [from, getAccessToken, hiddenStaff, scopedStaffList, to]);

  const allEvents = useMemo(() => [...events, ...gcalBusy], [events, gcalBusy]);

  const visibleStaffCount = useMemo(
    () => scopedStaffList.filter((staff) => !hiddenStaff.has(staff.id)).length,
    [hiddenStaff, scopedStaffList],
  );

  const hasActiveFilters = hiddenStaff.size > 0 || hiddenStatuses.size > 0;
  const activeFilterCount = hiddenStaff.size + hiddenStatuses.size;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: companySettings } = useCompanySettings();
  const showAddressField =
    companySettings?.serviceDeliveryModel == null ||
    companySettings.serviceDeliveryModel === 'at-customer' ||
    companySettings.serviceDeliveryModel === 'both';

  // Active services for the service dropdown
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });
  const selectableServices = useMemo(
    () => services.filter((s) => !s.isArchived && !s.isHidden),
    [services],
  );

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerAddress: '',
      bookingDate: '',
      startTime: '',
      endTime: '',
      staffMemberId: null,
      services: [{ serviceId: undefined as unknown as number, quantity: 1 }],
      customerNotes: '',
    },
  });

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
    control: form.control,
    name: 'services',
  });

  const [userEditedEndTime, setUserEditedEndTime] = useState(false);
  const [openServiceIdx, setOpenServiceIdx] = useState<number | null>(null);

  // Reset form whenever a new slot is clicked
  useEffect(() => {
    if (newBookingSlot) {
      setUserEditedEndTime(false);
      form.reset({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        bookingDate: newBookingSlot.date,
        startTime: newBookingSlot.startTime,
        endTime: '',
        staffMemberId: newBookingSlot.staffMemberId ?? null,
        services: [{ serviceId: undefined as unknown as number, quantity: 1 }],
        customerNotes: '',
      });
    }
  }, [newBookingSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchedServices = form.watch('services');
  const watchedStartTime = form.watch('startTime');

  // Clear customerAddress when field is hidden (D-09)
  useEffect(() => {
    if (!showAddressField) {
      form.setValue('customerAddress', '', { shouldValidate: false });
    }
  }, [showAddressField]); // eslint-disable-line react-hooks/exhaustive-deps

  // Customer type-ahead search (Plan 14-02)
  type ContactSuggestion = {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };

  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const watchedCustomerName = form.watch('customerName');
  const debouncedContactSearch = useDebounced(watchedCustomerName, 250);

  const { data: contactSuggestions = [], isLoading: contactsLoading } = useQuery<ContactSuggestion[]>({
    queryKey: ['/api/contacts', debouncedContactSearch],
    queryFn: async () => {
      const res = await apiRequest(
        'GET',
        `/api/contacts?search=${encodeURIComponent(debouncedContactSearch)}&limit=8`,
      );
      return res.json();
    },
    enabled: contactSearchOpen && debouncedContactSearch.trim().length >= 2,
    staleTime: 30_000,
  });

  const computedEndTime = useMemo(() => {
    if (!watchedStartTime || !watchedServices?.length) return '';
    const totalMinutes = watchedServices.reduce((sum, row) => {
      const svc = selectableServices.find((s) => s.id === row.serviceId);
      return sum + (svc ? svc.durationMinutes * (row.quantity || 1) : 0);
    }, 0);
    if (totalMinutes === 0) return '';
    return addMinutesToHHMM(watchedStartTime, totalMinutes);
  }, [watchedServices, watchedStartTime, selectableServices]);

  const estimatedTotal = useMemo(() => {
    const total = watchedServices?.reduce((sum, row) => {
      const svc = selectableServices.find((s) => s.id === row.serviceId);
      return sum + (svc ? Number(svc.price) * (row.quantity || 1) : 0);
    }, 0) ?? 0;
    return total > 0 ? total.toFixed(2) : null;
  }, [watchedServices, selectableServices]);

  // Sync computed endTime into the form when admin hasn't manually changed it (D-06)
  // Deps intentionally exclude userEditedEndTime — we only want this to fire when
  // the computed value changes, not when the user's edited flag changes (avoids race overwrite)
  useEffect(() => {
    if (!userEditedEndTime && computedEndTime) {
      form.setValue('endTime', computedEndTime, { shouldValidate: false });
    }
  }, [computedEndTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inline server error (409 conflict, non-Zod 400 messages) — D-16
  const [serverError, setServerError] = useState<string | null>(null);

  const createBookingMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest('POST', '/api/bookings', payload);
      return res.json();
    },
    onSuccess: async (created: { id: number }) => {
      // Honour D-10: status defaults to 'confirmed' for admin-created bookings.
      // storage.createBooking hardcodes 'pending' AND insertBookingSchemaBase strips
      // `status` from the PATCH body — so we use the dedicated PUT /:id/status route,
      // which calls storage.updateBookingStatus(id, status) directly.
      // Best-effort: a failure here does not roll back the create — booking exists either way.
      try {
        await apiRequest(
          'PUT',
          `/api/bookings/${created.id}/status`,
          { status: 'confirmed' },
        );
      } catch (statusErr) {
        console.warn('Failed to set booking status to confirmed:', statusErr);
      }

      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({ title: 'Booking created' });
      setNewBookingSlot(null);
      form.reset();
      setServerError(null);
    },
    onError: (err: any) => {
      // err is the Error thrown by throwIfResNotOk — it already carries .status and .data
      const status = err?.status as number | undefined;
      const data = err?.data;

      if (status === 400 && Array.isArray(data?.errors)) {
        // Zod field errors → setError on each field (D-17)
        for (const zerr of data.errors) {
          const fieldName = Array.isArray(zerr.path) && zerr.path.length > 0
            ? String(zerr.path[0])
            : null;
          if (fieldName && fieldName in form.getValues()) {
            form.setError(fieldName as any, {
              type: 'server',
              message: zerr.message,
            });
          }
        }
        setServerError(null);
        return;
      }

      // 409 (slot conflict, D-16) or other non-field errors
      setServerError(err?.message ?? 'Failed to create booking');
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      startTime: string;
      endTime: string;
      staffMemberId?: number | null;
    }) => {
      const { id, ...updates } = payload;
      const res = await apiRequest('PUT', `/api/bookings/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
  });

  // Clear serverError when the user starts editing again
  useEffect(() => {
    if (!serverError) return;
    const sub = form.watch(() => setServerError(null));
    return () => sub.unsubscribe();
  }, [serverError, form]);

  const onSubmit = (values: BookingFormValues) => {
    setServerError(null);

    // Derive totalDurationMinutes from startTime/endTime difference (D-07: no endTimeOverride)
    const [sh, sm] = values.startTime.split(':').map(Number);
    const [eh, em] = values.endTime.split(':').map(Number);
    const totalDurationMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));

    // Compute totalPrice as sum across all service rows (D-04)
    const totalPrice = values.services
      .reduce((sum, row) => {
        const svc = selectableServices.find((s) => s.id === row.serviceId);
        return sum + (svc ? Number(svc.price) * (row.quantity || 1) : 0);
      }, 0)
      .toFixed(2);

    const payload = {
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      customerAddress: values.customerAddress,
      customerEmail: values.customerEmail || null,
      bookingDate: values.bookingDate,
      startTime: values.startTime,
      endTime: values.endTime,
      totalDurationMinutes,
      totalPrice,
      paymentMethod: 'site' as const,
      staffMemberId: values.staffMemberId ?? null,
      // customerNotes attaches to first cart item only (consistent with prior D-02 pattern)
      cartItems: values.services.map((row, idx) => ({
        serviceId: row.serviceId,
        quantity: row.quantity || 1,
        ...(idx === 0 && values.customerNotes ? { customerNotes: values.customerNotes } : {}),
      })),
    };

    createBookingMutation.mutate(payload);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.isGcalBusy) return;
    const booking = bookings.find((item) => item.id === event.bookingId);
    if (booking) setSelectedBooking(booking);
  };

  const handleSelectSlot = ({ start, resourceId }: { start: Date; resourceId?: string | number }) => {
    const visibleStaff = scopedStaffList.filter((staff) => !hiddenStaff.has(staff.id));
    const resourceIdNum = typeof resourceId === 'string' ? Number(resourceId) : resourceId;
    const prefilledStaffId =
      resourceIdNum ??  // D-04: By Staff column click always pre-fills from column
      (visibleStaff.length === 1 ? visibleStaff[0].id : undefined);  // D-13 fallback (Phase 14)

    setNewBookingSlot({
      date: format(start, 'yyyy-MM-dd'),
      startTime: format(start, 'HH:mm'),
      staffMemberId: prefilledStaffId,
      isQuickBook: resourceId !== undefined,  // true = Quick Book modal (D-05); false = full form
    });
  };

  const handleEventDrop = ({
    event,
    start,
    end,
    resourceId,
  }: {
    event: CalendarEvent;
    start: Date;
    end: Date;
    resourceId?: number;
  }) => {
    if (event.isGcalBusy) return;  // D-13: gcal blocks are not draggable

    const originalStart = event.start;
    const originalEnd = event.end;
    const originalStaffId = event.staffMemberId;

    const newStartTime = format(start, 'HH:mm');
    const newEndTime = format(end, 'HH:mm');
    // D-11: resourceId is the target staff column's id; fall back to original if not in By Staff view
    const newStaffId = resourceId !== undefined ? resourceId : event.staffMemberId;

    const staffName =
      scopedStaffList.find((s) => s.id === newStaffId)?.firstName ?? 'Staff';

    reassignMutation.mutate(
      {
        id: event.bookingId,
        startTime: newStartTime,
        endTime: newEndTime,
        staffMemberId: newStaffId,
      },
      {
        onSuccess: () => {
          // D-12: undo toast with 5-second window
          toast({
            description: `${staffName} — ${format(start, 'h:mm a')} ✓`,
            action: (
              <ToastAction
                altText="Undo"
                onClick={() => {
                  reassignMutation.mutate({
                    id: event.bookingId,
                    startTime: format(originalStart, 'HH:mm'),
                    endTime: format(originalEnd, 'HH:mm'),
                    staffMemberId: originalStaffId,
                  });
                }}
              >
                Undo
              </ToastAction>
            ),
            duration: 5000,
          });
        },
      },
    );
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const accent = event.isGcalBusy ? '#94A3B8' : event.color;
    const surface = event.isGcalBusy ? 'rgba(148, 163, 184, 0.14)' : hexToRgba(accent, 0.16);

    return {
      className: cn(
        'appointments-calendar-event',
        event.isGcalBusy && 'appointments-calendar-event--busy',
      ),
      style: {
        backgroundColor: surface,
        border: `1px solid ${hexToRgba(accent, event.isGcalBusy ? 0.2 : 0.28)}`,
        borderLeft: `4px solid ${accent}`,
        color: 'hsl(var(--foreground))',
        borderRadius: 14,
        boxShadow: 'none',
        opacity: 1,
        cursor: event.isGcalBusy ? 'default' : 'pointer',
      } as CSSProperties,
    };
  };

  const toggleStaff = (id: number) => {
    setHiddenStaff((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStatus = (status: string) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  };

  const resetFilters = () => {
    setHiddenStaff(new Set());
    setHiddenStatuses(new Set());
  };

  useEffect(() => {
    setCurrentView(DEFAULT_CALENDAR_VIEW);
  }, []);

  const visibleStaffForResources = scopedStaffList.filter((s) => !hiddenStaff.has(s.id));

  const resourceProps = isByStaff
    ? {
        resources: visibleStaffForResources,
        resourceIdAccessor: (resource: any) => resource.id,
        resourceTitleAccessor: (resource: any) => resource.firstName,
        resourceAccessor: (event: any) => event.staffMemberId,
      }
    : {};

  const filterPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-full border border-border/70 bg-card px-4 shadow-sm text-sm font-medium"
        >
          <SlidersHorizontal className="mr-2 h-4 w-4 text-primary" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={10}
        className="w-[38rem] max-w-[calc(100vw-2rem)] rounded-[28px] border-border/80 bg-card p-0 shadow-2xl"
      >
        <div className="space-y-0">
          <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Filter calendar</div>
              <div className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                Refine by staff and booking status.
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs text-muted-foreground"
                onClick={resetFilters}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>

          <div className="space-y-4 px-5 py-4">
            {staffFiltersVisible && scopedStaffList.length > 0 && (
              <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users2 className="h-4 w-4 text-primary" />
                  Staff
                </div>
                <div className="flex flex-wrap gap-2">
                  {scopedStaffList.map((staff) => (
                    <FilterPill
                      key={staff.id}
                      label={`${staff.firstName} ${staff.lastName}`}
                      active={!hiddenStaff.has(staff.id)}
                      accentColor={getStaffColor(staff.id)}
                      surfaceColor={hexToRgba(getStaffColor(staff.id), 0.12)}
                      onClick={() => toggleStaff(staff.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                Status
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((status) => (
                  <FilterPill
                    key={status}
                    label={status}
                    active={!hiddenStatuses.has(status)}
                    accentColor={STATUS_ACCENTS[status]}
                    surfaceColor={STATUS_SURFACES[status]}
                    onClick={() => toggleStatus(status)}
                  />
                ))}
              </div>
            </div>

            <div
              className="inline-flex h-9 items-center gap-2 rounded-full border border-dashed px-3 text-sm text-slate-500 dark:text-slate-300"
              style={{
                backgroundColor: 'rgba(148, 163, 184, 0.10)',
                borderColor: 'rgba(148, 163, 184, 0.24)',
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              Google busy
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <Badge
            variant="secondary"
            className="w-fit rounded-full border-0 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary"
          >
            Planning Desk
          </Badge>

          <div className="space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight">Calendar</h1>
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
              View live bookings, compare staff workload, and overlay Google Calendar busy blocks
              without leaving the admin panel.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
          <MetricCard
            icon={CalendarDays}
            label="Visible Bookings"
            value={String(events.length)}
            toneClassName="bg-primary/10 text-primary"
          />
          <MetricCard
            icon={Users2}
            label="Visible Staff"
            value={String(visibleStaffCount)}
            toneClassName="bg-emerald-500/10 text-emerald-600"
          />
          <MetricCard
            icon={Clock3}
            label="Busy Blocks"
            value={String(gcalBusy.length)}
            toneClassName="bg-amber-500/10 text-amber-600"
          />
        </div>
      </div>

      <div className="appointments-calendar-shell">
        <div
          className="appointments-calendar-shell__board"
          style={{ height: 720, overflowX: isByStaff ? 'auto' : undefined }}
        >
          <DnDCalendar
            {...resourceProps}
            draggableAccessor={((event: CalendarEvent) => !event.isGcalBusy) as any}
            onEventDrop={handleEventDrop as any}
            className="appointments-calendar"
            localizer={localizer}
            events={allEvents}
            defaultView={DEFAULT_CALENDAR_VIEW}
            allDayAccessor={() => false}
            date={currentDate}
            view={currentView as any}
            onNavigate={setCurrentDate}
            onView={(v: string) => {
              setCurrentView(v);
              if (v !== 'day') setIsByStaff(false);
            }}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            scrollToTime={DEFAULT_SCROLL_TIME}
            eventPropGetter={eventStyleGetter as any}
            components={{
              event: EventComponent as any,
              toolbar: ((toolbarProps: any) => (
                <CalendarToolbar
                  {...toolbarProps}
                  isByStaff={isByStaff}
                  onByStaff={(active: boolean) => {
                    setIsByStaff(active);
                    if (active) setCurrentView(Views.DAY);
                  }}
                  filterControl={filterPopover}
                />
              )) as any,
            }}
            onSelectEvent={handleSelectEvent as any}
            onSelectSlot={handleSelectSlot as any}
            selectable
            style={{ height: '100%' }}
            popup
          />
        </div>
      </div>

      {scopedStaffList.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {scopedStaffList.map((staff) => (
            <div
              key={staff.id}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-2 shadow-sm"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getStaffColor(staff.id) }}
              />
              <span>{staff.firstName} {staff.lastName}</span>
            </div>
          ))}
          <div className="inline-flex items-center gap-2 rounded-full border border-dashed border-border/70 bg-card px-3 py-2 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            <span>Google busy block</span>
          </div>
        </div>
      )}

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
                <span>{selectedBooking.startTime} - {selectedBooking.endTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  style={{
                    background: STATUS_SURFACES[selectedBooking.status],
                    color: STATUS_ACCENTS[selectedBooking.status],
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

      {/* Quick Book modal — By Staff column slot click (D-05) */}
      {newBookingSlot?.isQuickBook && (
        <QuickBookModal
          open={newBookingSlot.isQuickBook}
          slot={newBookingSlot}
          staffList={scopedStaffList}
          onClose={() => setNewBookingSlot(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
            toast({ title: 'Booking created' });
          }}
          getAccessToken={getAccessToken}
          onOpenFullForm={() => {
            // Switch to full form: keep slot data, set isQuickBook=false
            setNewBookingSlot((prev) => prev ? { ...prev, isQuickBook: false } : null);
          }}
        />
      )}

      {/* Full Create Booking modal — regular slot click or "Full form →" from Quick Book */}
      <Dialog open={!!newBookingSlot && !newBookingSlot.isQuickBook} onOpenChange={() => setNewBookingSlot(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Booking</DialogTitle>
          </DialogHeader>
          {newBookingSlot && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Slot pre-fill display */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Date</span>
                    <div className="font-medium">{newBookingSlot.date}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Start</span>
                    <div className="font-medium">{newBookingSlot.startTime}</div>
                  </div>
                </div>

                {/* Staff: read-only when pre-filled, dropdown otherwise (D-13) */}
                {newBookingSlot.staffMemberId ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Staff</span>
                    <div className="font-medium">
                      {scopedStaffList.find((s) => s.id === newBookingSlot.staffMemberId)?.firstName}
                    </div>
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="staffMemberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Staff</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(Number(v))}
                          value={field.value ? String(field.value) : undefined}
                        >
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {scopedStaffList.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.firstName} {s.lastName ?? ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Customer name + phone on one row (D-11) */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer name</FormLabel>
                        <Popover
                          open={contactSearchOpen && debouncedContactSearch.trim().length >= 2}
                          onOpenChange={setContactSearchOpen}
                        >
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Input
                                placeholder="Type to search or enter new"
                                {...field}
                                onFocus={() => {
                                  if (field.value && field.value.trim().length >= 2) setContactSearchOpen(true);
                                }}
                                onChange={(e) => {
                                  field.onChange(e);
                                  setContactSearchOpen(e.target.value.trim().length >= 2);
                                }}
                                autoComplete="off"
                              />
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[--radix-popover-trigger-width] p-0"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <Command shouldFilter={false}>
                              <CommandList>
                                {contactsLoading ? (
                                  <div className="p-3 text-sm text-muted-foreground">Searching…</div>
                                ) : contactSuggestions.length === 0 ? (
                                  <CommandEmpty>No matches — type a new name to create</CommandEmpty>
                                ) : (
                                  <CommandGroup heading="Existing customers">
                                    {contactSuggestions.map((c) => (
                                      <CommandItem
                                        key={c.id}
                                        value={`${c.id}-${c.name}`}
                                        onSelect={() => {
                                          form.setValue('customerName', c.name, { shouldValidate: true });
                                          form.setValue('customerPhone', c.phone ?? '', { shouldValidate: true });
                                          form.setValue('customerEmail', c.email ?? '', { shouldValidate: true });
                                          form.setValue('customerAddress', c.address ?? '', { shouldValidate: true });
                                          setContactSearchOpen(false);
                                        }}
                                        className="flex flex-col items-start gap-0.5"
                                      >
                                        <span className="font-medium">{c.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {c.phone ?? 'no phone'}
                                          {c.email ? ` · ${c.email}` : ''}
                                        </span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="customerEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {showAddressField && (
                  <FormField control={form.control} name="customerAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {/* Service rows (CAL-03) */}
                <div className="space-y-2">
                  <FormLabel>Services</FormLabel>
                  {serviceFields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2">
                      <FormField
                        control={form.control}
                        name={`services.${index}.serviceId`}
                        render={({ field: f }) => (
                          <FormItem className="flex-1">
                            <Popover
                              open={openServiceIdx === index}
                              onOpenChange={(o) => setOpenServiceIdx(o ? index : null)}
                            >
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      'w-full justify-between font-normal',
                                      !f.value && 'text-muted-foreground'
                                    )}
                                  >
                                    {f.value
                                      ? selectableServices.find((s) => s.id === f.value)?.name ?? 'Select a service'
                                      : 'Select a service'}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search service..." />
                                  <CommandList>
                                    <CommandEmpty>No service found.</CommandEmpty>
                                    <CommandGroup>
                                      {selectableServices.map((s) => (
                                        <CommandItem
                                          key={s.id}
                                          value={s.name}
                                          onSelect={() => {
                                            f.onChange(s.id);
                                            setOpenServiceIdx(null);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              'mr-2 h-4 w-4',
                                              f.value === s.id ? 'opacity-100' : 'opacity-0'
                                            )}
                                          />
                                          {s.name} — ${Number(s.price).toFixed(2)} ({s.durationMinutes}m)
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`services.${index}.quantity`}
                        render={({ field: f }) => (
                          <FormItem className="w-20">
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                {...f}
                                onChange={(e) => f.onChange(Number(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={serviceFields.length === 1}
                        onClick={() => removeService(index)}
                        className="mb-0.5 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => appendService({ serviceId: undefined as unknown as number, quantity: 1 })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add service
                  </Button>
                </div>

                {/* End time: always-editable, auto-fills from computed duration sum (CAL-04) */}
                <FormField control={form.control} name="endTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setUserEditedEndTime(true);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Estimated total */}
                <div className="flex justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Estimated total</span>
                  <span className="font-medium">{estimatedTotal !== null ? `$${estimatedTotal}` : '—'}</span>
                </div>

                <FormField control={form.control} name="customerNotes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {serverError && (
                  <div
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {serverError}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={createBookingMutation.isPending}
                  className="w-full bg-[#FFFF01] text-black font-bold rounded-full hover:bg-[#FFFF01]/90 disabled:opacity-60"
                >
                  {createBookingMutation.isPending ? 'Creating…' : 'Create Booking'}
                </Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
