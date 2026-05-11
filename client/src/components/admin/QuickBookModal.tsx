import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
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
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { apiRequest } from '@/lib/queryClient';
import type { Service, StaffMember } from '@shared/schema';

// ---------------------------------------------------------------------------
// Module-scope helpers (mirrors AppointmentsCalendarSection)
// ---------------------------------------------------------------------------

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

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Zod schema — Quick Book uses a looser schema than the full form (D-09)
// ---------------------------------------------------------------------------

const quickBookSchema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  serviceId: z.number({ invalid_type_error: 'Select a service' }).int().positive(),
  quantity: z.number().int().min(1).default(1),
  // "More options" fields — all optional in Quick Book
  customerPhone: z.string().optional().or(z.literal('')),
  customerEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  customerNotes: z.string().optional(),
});

type QuickBookValues = z.infer<typeof quickBookSchema>;

// ---------------------------------------------------------------------------
// ContactSuggestion type (matches the pattern in AppointmentsCalendarSection)
// ---------------------------------------------------------------------------

type ContactSuggestion = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuickBookModalProps {
  open: boolean;
  slot: {
    date: string;
    startTime: string;
    staffMemberId?: number;
  } | null;
  staffList: StaffMember[];
  onClose: () => void;
  onSuccess: () => void;
  getAccessToken: () => Promise<string | null>;
  onOpenFullForm: () => void; // D-05: "Full form →" link handler
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickBookModal({
  open,
  slot,
  staffList,
  onClose,
  onSuccess,
  onOpenFullForm,
}: QuickBookModalProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Form
  // -------------------------------------------------------------------------

  const form = useForm<QuickBookValues>({
    resolver: zodResolver(quickBookSchema),
    defaultValues: {
      customerName: '',
      serviceId: undefined as unknown as number,
      quantity: 1,
      customerPhone: '',
      customerEmail: '',
      customerNotes: '',
    },
  });

  // Reset form whenever modal opens with a new slot
  useEffect(() => {
    if (open && slot) {
      setServerError(null);
      setMoreOptionsOpen(false);
      form.reset({
        customerName: '',
        serviceId: undefined as unknown as number,
        quantity: 1,
        customerPhone: '',
        customerEmail: '',
        customerNotes: '',
      });
    }
  }, [open, slot]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Services query
  // -------------------------------------------------------------------------

  const { data: allServices = [] } = useQuery<Service[]>({
    queryKey: ['/api/services'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/services');
      return res.json();
    },
    staleTime: 60_000,
  });

  const selectableServices = allServices.filter(
    (s) => !s.isArchived && !s.isHidden,
  );

  // -------------------------------------------------------------------------
  // Computed end time
  // -------------------------------------------------------------------------

  const watchedServiceId = form.watch('serviceId');
  const watchedQuantity = form.watch('quantity');

  const selectedService = selectableServices.find((s) => s.id === watchedServiceId);
  const computedEndTime =
    selectedService && slot
      ? addMinutesToHHMM(slot.startTime, selectedService.durationMinutes * (watchedQuantity || 1))
      : '';

  // -------------------------------------------------------------------------
  // Staff display name
  // -------------------------------------------------------------------------

  const staffName = slot?.staffMemberId
    ? staffList.find((s) => s.id === slot.staffMemberId)?.firstName ?? 'Staff'
    : null;

  // -------------------------------------------------------------------------
  // Customer type-ahead (replicates AppointmentsCalendarSection pattern)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Service combobox state
  // -------------------------------------------------------------------------

  const [servicePopoverOpen, setServicePopoverOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Mutation
  // -------------------------------------------------------------------------

  const quickBookMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest('POST', '/api/bookings', payload);
      return res.json();
    },
    onSuccess: async (created: { id: number }) => {
      // D-08: status = confirmed (same as Phase 14 D-10)
      try {
        await apiRequest('PUT', `/api/bookings/${created.id}/status`, { status: 'confirmed' });
      } catch {
        /* best-effort — booking exists even if status update fails */
      }
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const status = err?.status as number | undefined;
      const data = err?.data;

      if (status === 400 && Array.isArray(data?.errors)) {
        for (const zerr of data.errors) {
          const fieldName =
            Array.isArray(zerr.path) && zerr.path.length > 0 ? String(zerr.path[0]) : null;
          if (fieldName && fieldName in form.getValues()) {
            form.setError(fieldName as any, { type: 'server', message: zerr.message });
          }
        }
        return;
      }

      setServerError(err?.message ?? 'Failed to create booking');
    },
  });

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const onSubmit = (values: QuickBookValues) => {
    if (!slot) return;
    setServerError(null);

    const svc = selectableServices.find((s) => s.id === values.serviceId);
    const endTime = svc
      ? addMinutesToHHMM(slot.startTime, svc.durationMinutes * (values.quantity || 1))
      : slot.startTime;
    const totalDurationMinutes = svc ? svc.durationMinutes * (values.quantity || 1) : 0;
    const totalPrice = svc ? (Number(svc.price) * (values.quantity || 1)).toFixed(2) : '0.00';

    quickBookMutation.mutate({
      customerName: values.customerName,
      customerPhone: values.customerPhone || '', // D-09: defaults to '' for walk-ins
      customerEmail: values.customerEmail || null,
      customerAddress: '', // hidden in Quick Book; full form handles at-customer address
      bookingDate: slot.date,
      startTime: slot.startTime,
      endTime,
      totalDurationMinutes,
      totalPrice,
      paymentMethod: 'site', // D-08 (Phase 14 D-11)
      staffMemberId: slot.staffMemberId ?? null,
      cartItems: [{ serviceId: values.serviceId, quantity: values.quantity || 1 }],
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Parse the slot date for display
  const slotDate = slot ? new Date(`${slot.date}T00:00:00`) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Book</DialogTitle>
          {/* D-07: staff name + time as display text, not editable inputs */}
          {slot && (
            <p className="text-sm text-muted-foreground mt-1">
              {staffName ? `${staffName} · ` : ''}
              {slotDate ? format(slotDate, 'EEE MMM d') : slot.date}
              {' · '}
              {formatTime(slot.startTime)}
              {computedEndTime ? ` → ${formatTime(computedEndTime)}` : ''}
            </p>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Customer name with type-ahead (D-06 required field) */}
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
                          placeholder="Type name or 'Walk-in'"
                          {...field}
                          onFocus={() => {
                            if (field.value && field.value.trim().length >= 2)
                              setContactSearchOpen(true);
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

            {/* Service combobox (D-06 required field) */}
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service</FormLabel>
                  <Popover open={servicePopoverOpen} onOpenChange={setServicePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal"
                        >
                          {field.value
                            ? selectableServices.find((s) => s.id === field.value)?.name ??
                              'Select a service'
                            : 'Select a service'}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandList>
                          <CommandEmpty>No service found.</CommandEmpty>
                          <CommandGroup>
                            {selectableServices.map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.name}
                                onSelect={() => {
                                  field.onChange(s.id);
                                  setServicePopoverOpen(false);
                                }}
                              >
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

            {/* Collapsible "More options" (D-06: phone, email, notes) */}
            <Collapsible open={moreOptionsOpen} onOpenChange={setMoreOptionsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start text-sm text-muted-foreground px-0"
                >
                  <ChevronDown
                    className={`mr-1 h-3.5 w-3.5 transition-transform ${moreOptionsOpen ? 'rotate-180' : ''}`}
                  />
                  More options
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Phone{' '}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Email{' '}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Notes{' '}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Any special instructions…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Server error display */}
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}

            {/* Buttons row: "Full form →" link (D-05) + Submit */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                className="text-sm text-muted-foreground"
                onClick={onOpenFullForm}
              >
                Full form →
              </Button>
              <Button
                type="submit"
                disabled={quickBookMutation.isPending}
                className="flex-1 bg-[#FFFF01] text-black font-bold rounded-full hover:bg-yellow-300"
              >
                {quickBookMutation.isPending ? 'Booking…' : 'Book'}
              </Button>
            </div>

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
