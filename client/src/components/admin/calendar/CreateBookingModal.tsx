import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
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
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import type { Service, StaffMember } from '@shared/schema';

// ── Local helpers (unexported) ─────────────────────────────────────────────

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

// ── Zod schema (admin-specific, NOT the customer bookingSchema.ts) ─────────

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

// ── Props ──────────────────────────────────────────────────────────────────

interface CreateBookingModalProps {
  open: boolean;
  slot: {
    date: string;
    startTime: string;
    staffMemberId?: number;
  } | null;
  scopedStaffList: StaffMember[];
  selectableServices: Service[];
  showAddressField: boolean;
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
  onSuccess: () => void;
  onOpenQuickBook?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CreateBookingModal({
  open,
  slot,
  scopedStaffList,
  selectableServices,
  showAddressField,
  getAccessToken,
  onClose,
  onSuccess,
  onOpenQuickBook,
}: CreateBookingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset form whenever a new slot is clicked
  useEffect(() => {
    if (slot) {
      setUserEditedEndTime(false);
      form.reset({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        bookingDate: slot.date,
        startTime: slot.startTime,
        endTime: '',
        staffMemberId: slot.staffMemberId ?? null,
        services: [{ serviceId: undefined as unknown as number, quantity: 1 }],
        customerNotes: '',
      });
    }
  }, [slot]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchedServices = form.watch('services');
  const watchedStartTime = form.watch('startTime');
  const watchedCustomerName = form.watch('customerName');
  const debouncedContactSearch = useDebounced(watchedCustomerName, 250);

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
  useEffect(() => {
    if (!userEditedEndTime && computedEndTime) {
      form.setValue('endTime', computedEndTime, { shouldValidate: false });
    }
  }, [computedEndTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear serverError when the user starts editing again
  useEffect(() => {
    if (!serverError) return;
    const sub = form.watch(() => setServerError(null));
    return () => sub.unsubscribe();
  }, [serverError, form]);

  const createBookingMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest('POST', '/api/bookings', payload);
      return res.json();
    },
    onSuccess: async (created: { id: number }) => {
      // Honour D-10: status defaults to 'confirmed' for admin-created bookings.
      try {
        await apiRequest(
          'PUT',
          `/api/bookings/${created.id}/status`,
          { status: 'confirmed' },
        );
      } catch (statusErr) {
        console.warn('Failed to set booking status to confirmed:', statusErr);
      }

      form.reset();
      setServerError(null);
      onSuccess();  // parent invalidates /api/bookings query and shows toast
    },
    onError: (err: any) => {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Booking</DialogTitle>
        </DialogHeader>
        {slot && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Slot pre-fill display */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <div className="font-medium">{slot.date}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Start</span>
                  <div className="font-medium">{slot.startTime}</div>
                </div>
              </div>

              {/* Staff: read-only when pre-filled, dropdown otherwise (D-13) */}
              {slot.staffMemberId ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">Staff</span>
                  <div className="font-medium">
                    {scopedStaffList.find((s) => s.id === slot.staffMemberId)?.firstName}
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
  );
}
