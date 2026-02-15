import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { Booking, Service } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, ChevronDown, Clock, DollarSign, Loader2, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
interface BookingItem {
  id: number;
  bookingId: number;
  serviceId: number;
  serviceName: string;
  price: string;
  quantity?: number;
}

interface BookingEditItem {
  serviceId: number;
  serviceName: string;
  price: string;
  quantity: number;
}

type BookingUpdatePayload = Partial<{
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  customerAddress: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  totalPrice: string;
}> & {
  bookingItems?: BookingEditItem[];
};

function getBookingStatusColor(status: string) {
  switch (status) {
    case 'pending': return 'bg-warning/10 text-warning dark:text-warning border-warning/20';
    case 'confirmed': return 'bg-primary/10 text-primary border-primary/20';
    case 'completed': return 'bg-success/10 text-success border-success/20';
    case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function useBookingItems(bookingId: number, enabled: boolean = true) {
  return useQuery<BookingItem[]>({
    queryKey: ['/api/bookings', bookingId, 'items'],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/items`);
      return res.json();
    },
    enabled
  });
}

function BookingEditDialog({
  booking,
  services,
  bookingItems,
  open,
  onOpenChange,
  onSave,
  isSaving
}: {
  booking: Booking;
  services: Service[];
  bookingItems: BookingItem[] | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: BookingUpdatePayload) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    customerName: booking.customerName || '',
    customerEmail: booking.customerEmail || '',
    customerPhone: booking.customerPhone || '',
    customerAddress: booking.customerAddress || '',
    bookingDate: booking.bookingDate || '',
    startTime: booking.startTime || '',
    endTime: booking.endTime || ''
  });
  const [items, setItems] = useState<BookingEditItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setFormData({
      customerName: booking.customerName || '',
      customerEmail: booking.customerEmail || '',
      customerPhone: booking.customerPhone || '',
      customerAddress: booking.customerAddress || '',
      bookingDate: booking.bookingDate || '',
      startTime: booking.startTime || '',
      endTime: booking.endTime || ''
    });
  }, [open, booking]);

  useEffect(() => {
    if (!open) return;
    if (bookingItems) {
      setItems(
        bookingItems.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          price: item.price,
          quantity: item.quantity ?? 1
        }))
      );
    }
  }, [open, bookingItems]);

  const totalPrice = items
    .reduce((sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 1), 0)
    .toFixed(2);

  const addItem = () => {
    if (services.length === 0) return;
    const service = services[0];
    setItems((prev) => [
      ...prev,
      {
        serviceId: service.id,
        serviceName: service.name,
        price: String(service.price ?? '0'),
        quantity: 1
      }
    ]);
  };

  const updateItem = (index: number, updates: Partial<BookingEditItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (items.length === 0) return;
    onSave({
      ...formData,
      customerEmail: formData.customerEmail.trim() ? formData.customerEmail.trim() : null,
      totalPrice,
      bookingItems: items
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`booking-name-${booking.id}`}>Customer name</Label>
              <Input
                id={`booking-name-${booking.id}`}
                value={formData.customerName}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-email-${booking.id}`}>Email</Label>
              <Input
                id={`booking-email-${booking.id}`}
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-phone-${booking.id}`}>Phone</Label>
              <Input
                id={`booking-phone-${booking.id}`}
                value={formData.customerPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-address-${booking.id}`}>Address</Label>
              <Input
                id={`booking-address-${booking.id}`}
                value={formData.customerAddress}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerAddress: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-date-${booking.id}`}>Date</Label>
              <Input
                id={`booking-date-${booking.id}`}
                type="date"
                value={formData.bookingDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, bookingDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-start-${booking.id}`}>Start time</Label>
              <Input
                id={`booking-start-${booking.id}`}
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-end-${booking.id}`}>End time</Label>
              <Input
                id={`booking-end-${booking.id}`}
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Services</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                disabled={services.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add service
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add at least one service.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={`${item.serviceId}-${index}`}
                    className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_40px] gap-2 items-end"
                  >
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Service</Label>}
                      <Select
                        value={String(item.serviceId)}
                        onValueChange={(value) => {
                          const service = services.find((s) => s.id === Number(value));
                          if (!service) return;
                          updateItem(index, {
                            serviceId: service.id,
                            serviceName: service.name,
                            price: String(service.price ?? '0')
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {!services.some((service) => service.id === item.serviceId) && (
                            <SelectItem value={String(item.serviceId)}>
                              {item.serviceName} (removed)
                            </SelectItem>
                          )}
                          {services.map((service) => (
                            <SelectItem key={service.id} value={String(service.id)}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Qty</Label>}
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: Number(e.target.value || 1) })}
                      />
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Price</Label>}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItem(index, { price: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-600 hover:text-red-700"
                        onClick={() => removeItem(index)}
                        aria-label="Remove service"
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">${totalPrice}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={isSaving || items.length === 0}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookingRow({ booking, services, onUpdate, onDelete, isSaving }: {
  booking: Booking;
  services: Service[];
  onUpdate: (id: number, updates: BookingUpdatePayload) => void;
  onDelete: (id: number) => void;
  isSaving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { toast } = useToast();

  const { data: bookingItems } = useBookingItems(booking.id, expanded || isEditOpen);

  const handleStatusChange = (status: string) => {
    onUpdate(booking.id, { status });
    toast({ title: `Status changed to ${status}` });
  };

  const handlePaymentChange = (paymentStatus: string) => {
    onUpdate(booking.id, { paymentStatus });
    toast({ title: `Payment status changed to ${paymentStatus}` });
  };

  return (
    <>
      <tr className="hover:bg-muted/30 dark:hover:bg-slate-700/30 transition-colors">
        <td className="px-6 py-4">
          <div className="flex flex-wrap items-start gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{booking.customerName}</p>
              <p className="text-xs text-slate-500">{booking.customerEmail}</p>
              <p className="text-xs text-slate-400">{booking.customerPhone}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(!expanded)}
                data-testid={`button-expand-booking-${booking.id}`}
              >
                <ChevronDown className={clsx("w-3.5 h-3.5 mr-1 transition-transform", expanded && "rotate-180")} />
                {expanded ? 'Hide services' : 'Show services'}
              </Button>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {format(new Date(booking.bookingDate), "MMM dd, yyyy")}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {booking.startTime} - {booking.endTime}
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
            <span className="truncate max-w-[200px]" title={booking.customerAddress}>
              {booking.customerAddress}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 align-middle">
          <div className="flex items-center min-h-[56px]">
            <Select value={booking.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px] h-10 text-xs" data-testid={`select-status-${booking.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-warning/40 bg-warning/15" />
                    Pending
                  </span>
                </SelectItem>
                <SelectItem value="confirmed">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-primary/40 bg-primary/15" />
                    Confirmed
                  </span>
                </SelectItem>
                <SelectItem value="completed">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-secondary/70 bg-secondary/40" />
                    Completed
                  </span>
                </SelectItem>
                <SelectItem value="cancelled">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-destructive/40 bg-destructive/15" />
                    Cancelled
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </td>
        <td className="px-6 py-4">
          <Select value={booking.paymentStatus} onValueChange={handlePaymentChange}>
            <SelectTrigger className="w-[120px] h-10 text-xs" data-testid={`select-payment-${booking.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-emerald-500/40 bg-emerald-500/15" />
                  Paid
                </span>
              </SelectItem>
              <SelectItem value="unpaid">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-muted-foreground/30 bg-muted-foreground/15" />
                  Unpaid
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-6 py-4">
          <span
            className="font-bold text-foreground"
            data-testid={`text-amount-${booking.id}`}
          >
            ${booking.totalPrice}
          </span>
        </td>
        <td className="px-6 py-4 text-right align-middle">
          <div className="flex items-center justify-end min-h-[56px]">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 items-center justify-center"
              onClick={() => setIsEditOpen(true)}
              data-testid={`button-edit-booking-${booking.id}`}
              aria-label="Edit booking"
            >
              <Pencil className="w-4 h-4 text-slate-500" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 items-center justify-center"
                  data-testid={`button-delete-booking-${booking.id}`}
                  aria-label="Delete booking"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the booking for {booking.customerName}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(booking.id)}
                    variant="destructive"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </td>
      </tr>
      <BookingEditDialog
        booking={booking}
        services={services}
        bookingItems={bookingItems}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSave={(updates) => {
          onUpdate(booking.id, updates);
          toast({ title: 'Booking updated' });
        }}
        isSaving={isSaving}
      />
      {expanded && (
        <tr className="bg-muted/60">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Booked Services</h4>
              {bookingItems && bookingItems.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-slate-700">
                  {bookingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{item.serviceName}</span>
                      <span className="text-sm font-medium text-foreground">${item.price}</span>
                    </div>
                  ))}
                  <div className="h-px bg-gray-200 dark:bg-slate-700" />
                </div>
              ) : (
                <p className="text-sm text-slate-500">Loading services...</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}


function BookingMobileCard({
  booking,
  services,
  onUpdate,
  onDelete,
  isSaving
}: {
  booking: Booking;
  services: Service[];
  onUpdate: (id: number, data: BookingUpdatePayload) => void;
  onDelete: (id: number) => void;
  isSaving: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { toast } = useToast();
  const { data: items, isLoading: itemsLoading } = useBookingItems(booking.id, isExpanded || isEditOpen);
  const isItemsLoading = isExpanded && itemsLoading;

  const handleStatusChange = (status: string) => {
    onUpdate(booking.id, { status });
    toast({ title: `Status changed to ${status}` });
  };

  const handlePaymentStatusChange = (paymentStatus: string) => {
    onUpdate(booking.id, { paymentStatus });
    toast({ title: `Payment status changed to ${paymentStatus}` });
  };

  return (
    <Card className="mb-4 overflow-hidden border-0 bg-card/70 dark:bg-slate-900/70">
      <CardHeader className="p-4 pb-3 space-y-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-base truncate">{booking.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(booking.bookingDate), 'MMM dd, yyyy')} • {booking.startTime} - {booking.endTime}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">${booking.totalPrice}</p>
            <p className="text-xs text-muted-foreground">#{booking.id}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="w-4 h-4 mt-0.5" />
          <span className="truncate">{booking.customerAddress}</span>
        </div>

        <div className="grid gap-2">
          <Select onValueChange={handleStatusChange} defaultValue={booking.status}>
            <SelectTrigger className="h-9 text-xs w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select onValueChange={handlePaymentStatusChange} defaultValue={booking.paymentStatus}>
            <SelectTrigger className="h-9 text-xs w-full">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown className={clsx("w-3.5 h-3.5 mr-1 transition-transform", isExpanded && "rotate-180")} />
            {isExpanded ? 'Hide services' : 'Show services'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsEditOpen(true)}
            data-testid={`button-edit-booking-mobile-${booking.id}`}
            aria-label="Edit booking"
          >
            <Pencil className="w-4 h-4 text-slate-500" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(booking.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <BookingEditDialog
          booking={booking}
          services={services}
          bookingItems={items}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          onSave={(updates) => {
            onUpdate(booking.id, updates);
            toast({ title: 'Booking updated' });
          }}
          isSaving={isSaving}
        />

        {isExpanded && (
          <div className="mt-2 p-3 bg-card/70 dark:bg-slate-900/70 rounded-md space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services</h4>
            {isItemsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : items && items.length > 0 ? (
              <ul className="space-y-1">
                {items.map((item: any) => (
                  <li key={item.id} className="text-sm flex justify-between items-center">
                    <span>{item.serviceName}</span>
                    <span className="font-medium">${item.price}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">No services listed</p>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-muted-foreground">
              <p>Email: {booking.customerEmail}</p>
              <p>Phone: {booking.customerPhone}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BookingsSection() {
  const queryClient = useQueryClient();
  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['/api/bookings']
  });
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['/api/services']
  });
  const { toast } = useToast();
  const [bookingView, setBookingView] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const filteredBookings = useMemo(() => {
    const list = bookings || [];
    if (list.length === 0) return [];
    const now = new Date();

    return list.filter((booking) => {
      const time = booking.endTime || booking.startTime || '00:00';
      const dateTime = new Date(`${booking.bookingDate}T${time}`);
      const bookingIsPast = Number.isNaN(dateTime.getTime())
        ? new Date(booking.bookingDate) < now
        : dateTime < now;

      if (bookingView === 'all') return true;
      if (bookingView === 'past') return bookingIsPast;
      return !bookingIsPast;
    });
  }, [bookings, bookingView]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: BookingUpdatePayload }) => {
      const res = await apiRequest('PATCH', `/api/bookings/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/bookings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({ title: 'Booking deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleUpdate = (id: number, updates: BookingUpdatePayload) => {
    updateMutation.mutate({ id, updates });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage all customer bookings</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm font-semibold px-4 py-2 border-0 bg-muted dark:text-white">
            {filteredBookings.length} Total
          </Badge>
          <Select value={bookingView} onValueChange={(value) => setBookingView(value as 'upcoming' | 'past' | 'all')}>
            <SelectTrigger className="h-10 w-[150px] px-4 border-0 bg-muted text-sm font-semibold shadow-none" data-testid="select-bookings-view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {bookings?.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-card border border-border">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No bookings yet</h3>
          <p className="text-muted-foreground">Bookings will appear here when customers make them</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-card border border-border">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No bookings in this view</h3>
          <p className="text-muted-foreground">Try switching the filter to see past or upcoming bookings</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden xl:block bg-muted rounded-lg overflow-hidden transition-all">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 dark:bg-slate-700/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4 text-left">Customer</th>
                    <th className="px-6 py-4 text-left">Schedule</th>
                    <th className="px-6 py-4 text-left">Address</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Payment</th>
                    <th className="px-6 py-4 text-left">Amount</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card/70 dark:bg-slate-800/70 divide-y divide-gray-200/70 dark:divide-slate-600/40">
                  {filteredBookings.map((booking) => (
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      services={services}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      isSaving={updateMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:hidden space-y-4">
            {filteredBookings.map((booking) => (
              <BookingMobileCard
                key={booking.id}
                booking={booking}
                services={services}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                isSaving={updateMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


