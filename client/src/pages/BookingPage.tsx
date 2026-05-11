import { useCart } from "@/context/CartContext";
import { useAvailability, useCreateBooking, useMonthAvailability, useStaffCount } from "@/hooks/use-booking";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { Link, useLocation } from "wouter";
import { Trash2, Calendar as CalendarIcon, Clock, ChevronRight, CheckCircle2, ArrowLeft, ChevronLeft, Plus, Minus, X, User } from "lucide-react";
import { clsx } from "clsx";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { trackBeginCheckout, trackEvent } from "@/lib/analytics";
import type { StaffMember } from "@shared/schema";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { deriveCompanySlug, getVisitorIdKey } from "@/lib/visitor-key";

// Helper to format time based on format setting
function formatTime(time24: string, timeFormat: string): string {
  if (timeFormat === '24h') return time24;
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Schema for the form
const bookingFormSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Invalid email"),
  customerPhone: z.string().min(10, "Valid phone number required"),
  customerStreet: z.string().min(5, "Street address is required"),
  customerUnit: z.string().optional(),
  customerCity: z.string().min(2, "City is required"),
  customerState: z.string().min(2, "State is required"),
  paymentMethod: z.enum(["site", "online"]),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function BookingPage() {
  const [step, setStep] = useState<2 | 3 | 4 | 5>(2);
  const { items, totalPrice, totalDuration, removeItem, updateQuantity, updateItem, getCartItemsForBooking } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  // Phase 15 D-07: company-aware visitor key; aliased to avoid name collision with the
  // parallel useQuery `companySettings` declared further down in this component.
  const { settings: csForKey, isReady: settingsReady } = useCompanySettings();

  // Booking State - start with tomorrow
  const [selectedDate, setSelectedDate] = useState<string>(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  // Map from serviceId → chosen ServiceDuration (only for services that have durations)
  const [selectedDurations, setSelectedDurations] = useState<Record<number, any>>({});
  // Phase 28 RECUR-01: null = one-time, number = serviceFrequency.id
  const [selectedFrequencyId, setSelectedFrequencyId] = useState<number | null>(null);

  // Staff
  const { data: staffCountData } = useStaffCount();
  const staffCount = staffCountData?.count ?? 0;

  const { data: staffList } = useQuery<StaffMember[]>({
    queryKey: ['/api/staff'],
    queryFn: () => fetch('/api/staff').then(r => r.json()),
    enabled: staffCount > 1,
  });

  // Auto-skip staff step when count <= 1
  useEffect(() => {
    if (staffCountData !== undefined && staffCount <= 1 && step === 2) {
      setStep(3);
    }
  }, [staffCountData, staffCount, step]);

  // Service IDs from cart for cross-service availability
  const serviceIds = items.map(item => item.id);
  const availabilityOptions = { staffId: selectedStaff?.id, serviceIds };

  // API Hooks
  const { data: slots, isLoading: isLoadingSlots, isFetching: isFetchingSlots } = useAvailability(selectedDate, totalDuration, availabilityOptions);

  // D-15, D-16: per-staff availability for multi-staff sites
  const perStaffAvailability = useQueries({
    queries: (staffList ?? []).map((member) => ({
      queryKey: ['/api/availability', selectedDate, totalDuration, member.id, serviceIds],
      queryFn: async (): Promise<Array<{ time: string; available: boolean }>> => {
        if (!selectedDate || totalDuration === 0) return [];
        const params = new URLSearchParams({
          date: selectedDate,
          totalDurationMinutes: String(totalDuration),
          staffId: String(member.id),
        });
        if (serviceIds.length) params.append('serviceIds', serviceIds.join(','));
        const res = await fetch(`/api/availability?${params}`);
        if (!res.ok) return [];
        return res.json();
      },
      enabled: !!selectedDate && totalDuration > 0 && staffCount > 1,
      staleTime: 0,
      gcTime: 0,
    })),
  });

  // Build a map from time slot → array of available staff for that slot
  const staffBySlot = new Map<string, StaffMember[]>();
  if (staffCount > 1 && staffList) {
    perStaffAvailability.forEach((query, idx) => {
      const member = staffList[idx];
      if (!member || !query.data) return;
      query.data
        .filter((s) => s.available)
        .forEach((s) => {
          const existing = staffBySlot.get(s.time) ?? [];
          staffBySlot.set(s.time, [...existing, member]);
        });
    });
  }

  const isPerStaffLoading = staffCount > 1 && perStaffAvailability.some((q) => q.isLoading);

  // Fetch service details (with durations) for each cart item
  const serviceDetailsQueries = useQueries({
    queries: items.map(item => ({
      queryKey: ['/api/services', item.id],
      queryFn: () => fetch(`/api/services/${item.id}`).then(r => r.json()),
      staleTime: 60_000,
    })),
  });

  // Phase 28 RECUR-01: fetch frequencies for the primary (and only) cart item.
  // Only shown for single-service carts to avoid ambiguity about which service recurs.
  const primaryServiceId = items.length === 1 ? items[0].id : undefined;
  const { data: frequencies } = useQuery<import("@shared/schema").ServiceFrequency[]>({
    queryKey: ['/api/services', primaryServiceId, 'frequencies'],
    queryFn: () => fetch(`/api/services/${primaryServiceId}/frequencies`).then(r => r.json()),
    enabled: !!primaryServiceId,
    staleTime: 60_000,
  });

  // Derive which services need duration selection
  const itemsWithDurations = serviceDetailsQueries
    .filter(q => Array.isArray(q.data?.durations) && q.data.durations.length > 0)
    .map(q => q.data);

  const allDurationsSelected = itemsWithDurations.length === 0 || itemsWithDurations.every(
    (svc: any) => selectedDurations[svc.id] !== undefined
  );

  const serviceDetailsLoading = serviceDetailsQueries.some(q => q.isLoading);

  const createBooking = useCreateBooking();

  const checkoutMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Checkout failed");
      }
      return res.json() as Promise<{ sessionUrl: string; bookingId: number }>;
    },
    onSuccess: (data) => {
      window.location.href = data.sessionUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const { data: companySettings } = useQuery<{ timeFormat?: string; minimumBookingValue?: string }>({ queryKey: ['/api/company-settings'] });

  // Fetch monthly availability to disable dates without slots
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth() + 1; // 1-12
  const { data: monthAvailability, isLoading: isLoadingMonthAvailability, isFetching: isFetchingMonthAvailability } = useMonthAvailability(viewYear, viewMonth, totalDuration, availabilityOptions);
  const isSlotsPending = isLoadingSlots || isFetchingSlots || isPerStaffLoading || serviceDetailsLoading;
  const isMonthAvailabilityPending = isLoadingMonthAvailability || isFetchingMonthAvailability;
  const timeFormat = companySettings?.timeFormat || '12h';
  const minimumBookingValueStr = companySettings?.minimumBookingValue || '0';
  const minimumBookingValue = parseFloat(minimumBookingValueStr) || 0;
  const isBelowMinimum = minimumBookingValue > 0 && totalPrice < minimumBookingValue;
  const adjustmentAmount = isBelowMinimum ? minimumBookingValue - totalPrice : 0;
  const finalPrice = isBelowMinimum ? minimumBookingValue : totalPrice;

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      paymentMethod: "site",
    }
  });

  const calendarRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    // Scroll to booking summary after selecting a time (only if not already visible)
    setTimeout(() => {
      summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  // Phase 15 D-07: gate on settingsReady so visitor key is tenant-correct.
  // useRef "has fired" guard prevents re-firing booking_started when settings reload mid-session.
  const bookingStartedFiredRef = useRef(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!settingsReady || bookingStartedFiredRef.current) return;
    if (items.length > 0) {
      bookingStartedFiredRef.current = true;
      trackBeginCheckout(
        items.map(item => ({ id: item.id, name: item.name, price: Number(item.price), quantity: item.quantity })),
        totalPrice
      );
      // D-01, EVENTS-02: fire-and-forget booking_started event — only when cart is non-empty
      const visitorId = localStorage.getItem(getVisitorIdKey(deriveCompanySlug(csForKey)));
      fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: visitorId ?? undefined,
          eventType: 'booking_started',
          pageUrl: window.location.pathname,
        }),
      }).catch(() => {});
    }
  }, [settingsReady, csForKey, items, totalPrice]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("cancelled") === "1") {
      toast({
        title: "Payment cancelled",
        description: "Your booking was not completed. You can try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/booking");
    }
  }, []);

  const handleNextStep = (nextStep: 2 | 3 | 4 | 5) => {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = (data: BookingFormValues) => {
    if (!selectedDate || !selectedTime) return;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const endDate = new Date();
    endDate.setHours(hours, minutes + totalDuration);
    const endTime = format(endDate, "HH:mm");

    const fullAddress = `${data.customerStreet}${data.customerUnit ? `, ${data.customerUnit}` : ""}, ${data.customerCity}, ${data.customerState}`;

    // Phase 28 RECUR-01: attach selectedFrequencyId to the first cart item only
    const cartItemsWithFrequency = getCartItemsForBooking().map((cartItem: any, idx: number) => {
      if (idx === 0 && selectedFrequencyId !== null) {
        return { ...cartItem, selectedFrequencyId };
      }
      return cartItem;
    });

    const bookingPayload = {
      ...data,
      customerAddress: fullAddress,
      cartItems: cartItemsWithFrequency,
      bookingDate: selectedDate,
      startTime: selectedTime,
      endTime: endTime,
      totalDurationMinutes: totalDuration,
      totalPrice: String(finalPrice),
      staffMemberId: selectedStaff?.id ?? null,
      // D-07, ATTR-02: visitorId is outside insertBookingSchema — server reads from req.body directly
      // D-03: undefined when localStorage is null (private browsing) — server skips attribution silently
      // Phase 15 D-07: visitor key derived from companyName slug; null when settings not ready
      visitorId: (settingsReady
        ? localStorage.getItem(getVisitorIdKey(deriveCompanySlug(csForKey)))
        : null) ?? undefined,
    };

    if (data.paymentMethod === "online") {
      checkoutMutation.mutate(bookingPayload);
    } else {
      createBooking.mutate(bookingPayload as any, {
        onSuccess: (data: any) => {
          if (data?.status === 'awaiting_approval') {
            setLocation("/confirmation?awaiting=true");
          } else {
            setLocation("/confirmation");
          }
        },
        onError: (error) => {
          toast({
            title: "Booking Failed",
            description: error.message,
            variant: "destructive"
          });
        }
      });
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-slate-500 mb-8">Add some services to get started.</p>
        <Link href="/services">
          <button className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:-translate-y-1 transition-all">
            Browse Services
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 py-8 min-h-[60vh]">
      <div className="container-custom mx-auto max-w-5xl mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* STEP 2: STAFF SELECTION */}
            {step === 2 && staffCount > 1 && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-2xl font-bold mb-2">Choose Your Professional</h2>
                <p className="text-slate-500 text-sm mb-6">Select who you'd like to work with, or choose any available professional.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                  {/* Any Professional option */}
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className={clsx(
                      "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                      selectedStaff === null
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="w-8 h-8 text-slate-400" />
                    </div>
                    <span className="font-semibold text-sm text-center">Any Professional</span>
                  </button>
                  {/* Staff member cards */}
                  {staffList?.map(member => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedStaff(member)}
                      className={clsx(
                        "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                        selectedStaff?.id === member.id
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {member.profileImageUrl ? (
                        <img src={member.profileImageUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                      )}
                      <div className="text-center">
                        <p className="font-semibold text-sm">{member.firstName} {member.lastName}</p>
                        {member.bio && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{member.bio}</p>}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleNextStep(3)}
                  className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  Continue to Schedule <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* DURATION SELECTOR — rendered before calendar when services have durations */}
            {step === 3 && itemsWithDurations.length > 0 && !allDurationsSelected && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-2xl font-bold mb-2">Choose Your Duration</h2>
                <p className="text-slate-500 text-sm mb-6">Select how long you need for each service.</p>
                <div className="space-y-6">
                  {itemsWithDurations.map((svc: any) => (
                    <div key={svc.id}>
                      <p className="font-semibold mb-3 text-slate-800">{svc.name}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {svc.durations.map((d: any) => (
                          <button
                            key={d.id}
                            onClick={() => setSelectedDurations(prev => ({ ...prev, [svc.id]: d }))}
                            className={clsx(
                              "p-4 rounded-xl border-2 text-left transition-all",
                              selectedDurations[svc.id]?.id === d.id
                                ? "border-primary bg-primary/5"
                                : "border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <p className="font-semibold text-sm">{d.label}</p>
                            <p className="text-slate-500 text-xs mt-1">
                              {Math.floor(d.durationMinutes / 60)}h {d.durationMinutes % 60 > 0 ? `${d.durationMinutes % 60}m ` : ''}— ${Number(d.price).toFixed(2)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  disabled={!allDurationsSelected}
                  onClick={() => {
                    // Apply selected durations to cart items
                    itemsWithDurations.forEach((svc: any) => {
                      const chosen = selectedDurations[svc.id];
                      if (chosen) {
                        updateItem(svc.id, {
                          service: { ...svc, durationMinutes: chosen.durationMinutes },
                          calculatedPrice: Number(chosen.price),
                          selectedDurationId: chosen.id,
                        });
                      }
                    });
                  }}
                  className="mt-6 w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue to Schedule <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* STEP 3: SCHEDULE */}
            {step === 3 && (allDurationsSelected || itemsWithDurations.length === 0) && (
              <div ref={calendarRef} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 text-slate-900">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Calendar Column */}
                  <div>
                    <div className="flex items-center justify-between mb-8">
                      <button
                        onClick={() => setViewDate(subMonths(viewDate, 1))}
                        className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors border border-gray-100"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <h3 className="text-lg font-bold text-slate-900">{format(viewDate, "MMMM yyyy")}</h3>
                      <button
                        onClick={() => setViewDate(addMonths(viewDate, 1))}
                        className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors border border-gray-100"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 mb-4">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                        <div key={day} className="text-center text-xs font-bold text-slate-400 py-2 uppercase tracking-wider">
                          {day.substring(0, 3)}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {(() => {
                        const monthStart = startOfMonth(viewDate);
                        const monthEnd = endOfMonth(monthStart);
                        const startDate = startOfWeek(monthStart);
                        const endDate = endOfWeek(monthEnd);
                        const rows = [];
                        let days = [];
                        let day = startDate;

                        while (day <= endDate) {
                          for (let i = 0; i < 7; i++) {
                            const currentDay = day;
                            const isCurrentMonth = isSameMonth(currentDay, monthStart);
                            const dateStr = format(currentDay, "yyyy-MM-dd");
                            const isSelected = selectedDate === dateStr;
                            const isToday = isSameDay(currentDay, new Date());
                            const isPast = currentDay < new Date() && !isToday;

                            const isAvailable = !isMonthAvailabilityPending && monthAvailability ? monthAvailability[dateStr] === true : false;

                            days.push(
                              <div key={currentDay.toString()} className="flex justify-center items-center aspect-square p-0.5">
                                <button
                                  disabled={!isCurrentMonth || isPast || !isAvailable || isMonthAvailabilityPending}
                                  onClick={() => {
                                    setSelectedDate(dateStr);
                                    setSelectedTime("");
                                    // Scroll to time slots after date selection (only if not already visible)
                                    setTimeout(() => {
                                      slotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                    }, 100);
                                  }}
                                  className={clsx(
                                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all relative shrink-0",
                                    !isCurrentMonth && "opacity-0 cursor-default",
                                    (isPast || !isAvailable) && isCurrentMonth && "text-slate-200 cursor-not-allowed opacity-40",
                                    isCurrentMonth && !isPast && isAvailable && !isSelected && "text-slate-600 hover:bg-slate-50 hover:text-primary border border-transparent",
                                    isSelected && isAvailable && "bg-primary text-white shadow-md shadow-primary/20",
                                    isToday && !isSelected && isAvailable && "text-primary border-primary/30 bg-primary/5"
                                  )}
                                >
                                  {format(currentDay, "d")}
                                </button>
                              </div>
                            );
                            day = addDays(day, 1);
                          }
                          rows.push(days);
                          days = [];
                        }
                        return rows;
                      })()}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-sm text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span>Time zone: GMT-05:00 America/New_York (EST)</span>
                    </div>
                  </div>

                  {/* Slots Column */}
                  <div ref={slotsRef} className="relative max-h-[440px] overflow-y-auto">
                    <div className="space-y-3">
                      {isSlotsPending ? (
                        [1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="h-14 bg-slate-50 border border-slate-100 rounded-xl animate-pulse"></div>
                        ))
                      ) : slots && slots.some(s => s.available) ? (
                        <div className="grid grid-cols-1 gap-3">
                          {slots
                            .filter((slot) => slot.available)
                            .map((slot) => {
                              const availableStaff = staffBySlot.get(slot.time) ?? [];
                              return (
                                <div key={slot.time} className="px-1 py-1">
                                  <button
                                    onClick={() => handleTimeSelect(slot.time)}
                                    className={clsx(
                                      "w-full py-4 px-6 rounded-xl font-bold transition-all border text-center",
                                      selectedTime === slot.time
                                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.01]"
                                        : "bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5"
                                    )}
                                  >
                                    <div className="text-sm">{formatTime(slot.time, timeFormat)}</div>
                                    {staffCount > 1 && availableStaff.length > 0 && (
                                      <div className="flex flex-wrap justify-center gap-1 mt-2">
                                        {availableStaff.map((member) => (
                                          <span
                                            key={member.id}
                                            className={clsx(
                                              "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                              selectedTime === slot.time
                                                ? "bg-white/20 text-white"
                                                : "bg-slate-100 text-slate-600"
                                            )}
                                          >
                                            {member.firstName}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                          <p className="text-slate-400 text-sm font-medium">
                            {selectedDate ? (slots && slots.length > 0 ? "No slots available for this date" : "No available slots for this duration.") : "Select a date to view available times."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: CONTACT INFORMATION */}
            {step === 4 && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setStep(3)} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl font-bold">Contact Details</h2>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <input
                        {...form.register("customerName")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="John Doe"
                      />
                      {form.formState.errors.customerName && <p className="text-red-500 text-xs">{form.formState.errors.customerName.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Email</label>
                      <input
                        {...form.register("customerEmail")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="john@example.com"
                      />
                      {form.formState.errors.customerEmail && <p className="text-red-500 text-xs">{form.formState.errors.customerEmail.message}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Phone Number</label>
                    <input
                      {...form.register("customerPhone")}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, "");
                        if (value.length > 10) value = value.slice(0, 10);

                        let maskedValue = "";
                        if (value.length > 0) {
                          maskedValue = "(" + value.slice(0, 3);
                          if (value.length > 3) {
                            maskedValue += ") " + value.slice(3, 6);
                          }
                          if (value.length > 6) {
                            maskedValue += "-" + value.slice(6, 10);
                          }
                        }
                        e.target.value = maskedValue;
                        form.setValue("customerPhone", maskedValue, { shouldValidate: true });
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      placeholder="(555) 123-4567"
                    />
                    {form.formState.errors.customerPhone && <p className="text-red-500 text-xs">{form.formState.errors.customerPhone.message}</p>}
                  </div>

                  {step === 4 && (
                    <button
                      type="button"
                      onClick={async () => {
                        const isValid = await form.trigger(["customerName", "customerEmail", "customerPhone"]);
                        if (isValid) {
                          handleNextStep(5);
                        }
                      }}
                      className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                    >
                      Continue to Address <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 5: ADDRESS & PAYMENT */}
            {step === 5 && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setStep(4)} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl font-bold">Address & Payment</h2>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Street Address</label>
                      <input
                        {...form.register("customerStreet")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="123 Main St"
                      />
                      {form.formState.errors.customerStreet && <p className="text-red-500 text-xs">{form.formState.errors.customerStreet.message}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2 col-span-2">
                        <label className="text-sm font-medium text-slate-700">City</label>
                        <input
                          {...form.register("customerCity")}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          placeholder="Boston"
                        />
                        {form.formState.errors.customerCity && <p className="text-red-500 text-xs">{form.formState.errors.customerCity.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">State</label>
                        <input
                          {...form.register("customerState")}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          placeholder="MA"
                        />
                        {form.formState.errors.customerState && <p className="text-red-500 text-xs">{form.formState.errors.customerState.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Unit / Apt <span className="text-slate-400 font-normal">(Optional)</span></label>
                      <input
                        {...form.register("customerUnit")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Apt 4B"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <label className="text-sm font-medium text-slate-700 mb-4 block">Payment Method</label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={clsx(
                        "p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center gap-2 text-center",
                        form.watch("paymentMethod") === "site"
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                          : "border-gray-200 hover:bg-slate-50"
                      )}>
                        <input type="radio" value="site" {...form.register("paymentMethod")} className="hidden" />
                        <span className="font-bold">Pay on Site</span>
                        <span className="text-xs opacity-70">Cash or Card upon arrival</span>
                      </label>
                      <label className={clsx(
                        "p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center gap-2 text-center",
                        form.watch("paymentMethod") === "online"
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                          : "border-gray-200 hover:bg-slate-50"
                      )}>
                        <input type="radio" value="online" {...form.register("paymentMethod")} className="hidden" />
                        <span className="font-bold">Pay Online</span>
                        <span className="text-xs opacity-70">Secure online payment</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={createBooking.isPending || checkoutMutation.isPending}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8 text-lg"
                  >
                    {createBooking.isPending || checkoutMutation.isPending
                      ? "Processing..."
                      : form.watch("paymentMethod") === "online"
                        ? `Pay $${finalPrice.toFixed(2)} with Stripe`
                        : `Confirm Booking - $${finalPrice.toFixed(2)}`}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sticky Summary Sidebar */}
          <div className="lg:col-span-1" ref={summaryRef}>
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-24">
              <h3 className="font-bold text-xl mb-4 text-slate-900">Booking Summary</h3>

              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-700 font-medium text-sm leading-tight line-clamp-2 flex-1">{item.name}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                        aria-label="Remove item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {item.areaSize && (
                      <span className="text-xs text-slate-500">Size: {item.areaSize}{item.areaValue ? ` (${item.areaValue} sqft)` : ''}</span>
                    )}
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <div className="text-xs text-slate-500">
                        Add-ons: {item.selectedOptions.map(opt => `${opt.name}${opt.quantity > 1 ? ` x${opt.quantity}` : ''}`).join(', ')}
                      </div>
                    )}
                    {item.selectedFrequency && (
                      <span className="text-xs text-slate-500">
                        Frequency: {item.selectedFrequency.name}
                        {item.selectedFrequency.discountPercent > 0 && ` (-${item.selectedFrequency.discountPercent}%)`}
                      </span>
                    )}
                    {item.customerNotes && (
                      <span className="text-xs text-slate-500 italic">Note: {item.customerNotes.substring(0, 50)}{item.customerNotes.length > 50 ? '...' : ''}</span>
                    )}

                    <div className="flex justify-between items-center">
                      <div className="flex items-center bg-white rounded-lg p-0.5 gap-1 border border-slate-200 shadow-sm">
                        <button
                          onClick={() => {
                            if (item.quantity > 1) {
                              updateQuantity(item.id, item.quantity - 1);
                            } else {
                              removeItem(item.id);
                            }
                          }}
                          className="p-1 hover:bg-slate-50 rounded transition-colors text-slate-600"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 hover:bg-slate-50 rounded transition-colors text-slate-600"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-sm text-slate-900">${item.calculatedPrice.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between text-slate-500 text-sm">
                  <span>Duration</span>
                  <span>{Math.floor(totalDuration / 60)}h {totalDuration % 60}m</span>
                </div>
                {selectedDate && (
                  <div className="flex justify-between text-slate-500 text-sm">
                    <span>Date</span>
                    <span>{format(new Date(selectedDate), "MMM do, yyyy")}</span>
                  </div>
                )}
                {selectedTime && (
                  <div className="flex justify-between text-slate-500 text-sm">
                    <span>Time</span>
                    <span>{formatTime(selectedTime, timeFormat)}</span>
                  </div>
                )}
                {selectedStaff && (
                  <div className="flex justify-between text-slate-500 text-sm">
                    <span>Professional</span>
                    <span>{selectedStaff.firstName} {selectedStaff.lastName}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between text-slate-600 text-sm">
                  <span>Subtotal</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                {isBelowMinimum && (
                  <div className="flex justify-between text-slate-500 text-sm">
                    <span>Minimum order adjustment</span>
                    <span>+${adjustmentAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 mt-2 flex justify-between items-center">
                <span className="font-bold text-lg text-slate-900">Total</span>
                <span className="font-bold text-2xl text-primary">${finalPrice.toFixed(2)}</span>
              </div>

              {isBelowMinimum && (
                <p className="text-xs text-slate-400 mt-2">
                  A minimum order of ${minimumBookingValue.toFixed(2)} applies
                </p>
              )}

              {/* Phase 28 RECUR-01: frequency selector — shown after time slot selected, single-service carts only */}
              {step === 3 && selectedDate && selectedTime && frequencies && frequencies.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-semibold text-slate-700 mb-3">How often?</p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFrequencyId(null)}
                      className={clsx(
                        "w-full px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
                        selectedFrequencyId === null
                          ? "border-primary bg-primary/5 font-semibold"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      One-time cleaning
                    </button>
                    {frequencies.map(f => (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setSelectedFrequencyId(f.id)}
                        className={clsx(
                          "w-full px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
                          selectedFrequencyId === f.id
                            ? "border-primary bg-primary/5 font-semibold"
                            : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <span>{f.name}</span>
                        {Number(f.discountPercent) > 0 && (
                          <span className="ml-2 text-green-600 font-bold">
                            {Number(f.discountPercent)}% off
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8">
                {step === 3 && (
                  <button
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => handleNextStep(4)}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Continue to Contact <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
