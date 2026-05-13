import { useCart } from "@/context/CartContext";
import { useAvailability, useCreateBooking, useMonthAvailability, useStaffCount } from "@/hooks/use-booking";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays } from "date-fns";
import { Link, useLocation } from "wouter";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { trackBeginCheckout } from "@/lib/analytics";
import type { StaffMember } from "@shared/schema";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { deriveCompanySlug, getVisitorIdKey } from "@/lib/visitor-key";
import { bookingFormSchema, type BookingFormValues } from './booking/bookingSchema';
import { StepStaffSelector } from './booking/StepStaffSelector';
import { StepTimeSlot } from './booking/StepTimeSlot';
import { StepCustomerDetails } from './booking/StepCustomerDetails';
import { StepPaymentMethod } from './booking/StepPaymentMethod';
import { BookingSummary } from './booking/BookingSummary';

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

            {step === 2 && staffCount > 1 && (
              <StepStaffSelector
                staffList={staffList}
                selectedStaff={selectedStaff}
                onSelectStaff={setSelectedStaff}
                onNext={() => handleNextStep(3)}
              />
            )}

            {step === 3 && (
              <StepTimeSlot
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                viewDate={viewDate}
                slots={slots}
                monthAvailability={monthAvailability}
                isSlotsPending={isSlotsPending}
                isMonthAvailabilityPending={isMonthAvailabilityPending}
                staffBySlot={staffBySlot}
                staffCount={staffCount}
                timeFormat={timeFormat}
                itemsWithDurations={itemsWithDurations}
                selectedDurations={selectedDurations}
                allDurationsSelected={allDurationsSelected}
                onSelectDate={setSelectedDate}
                onSelectTime={handleTimeSelect}
                onViewDateChange={setViewDate}
                onDurationSelect={(svcId, duration) =>
                  setSelectedDurations((prev) => ({ ...prev, [svcId]: duration }))
                }
                onApplyDurations={() => {
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
              />
            )}

            {step === 4 && (
              <StepCustomerDetails
                form={form}
                onNext={() => handleNextStep(5)}
                onBack={() => setStep(3)}
              />
            )}

            {step === 5 && (
              <StepPaymentMethod
                form={form}
                finalPrice={finalPrice}
                isBelowMinimum={isBelowMinimum}
                minimumBookingValue={minimumBookingValue}
                adjustmentAmount={adjustmentAmount}
                isPending={createBooking.isPending || checkoutMutation.isPending}
                onSubmit={form.handleSubmit(onSubmit)}
                onBack={() => setStep(4)}
              />
            )}
          </div>

          <div className="lg:col-span-1" ref={summaryRef}>
            <BookingSummary
              items={items}
              step={step}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              selectedStaff={selectedStaff}
              totalDuration={totalDuration}
              totalPrice={totalPrice}
              finalPrice={finalPrice}
              isBelowMinimum={isBelowMinimum}
              minimumBookingValue={minimumBookingValue}
              adjustmentAmount={adjustmentAmount}
              timeFormat={timeFormat}
              frequencies={frequencies}
              selectedFrequencyId={selectedFrequencyId}
              onSelectFrequency={setSelectedFrequencyId}
              onRemoveItem={removeItem}
              onUpdateQuantity={updateQuantity}
              onContinueToContact={() => handleNextStep(4)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
