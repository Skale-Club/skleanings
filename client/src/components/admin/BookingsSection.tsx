import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { Booking, Service } from '@shared/schema';
import { apiRequest, authenticatedRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Calendar, ChevronDown, Clock, Loader2, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';

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

import { SharedBookingCard, useBookingItems } from '@/components/admin/shared/SharedBookingCard';

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

function InteractiveBookingCard({
  booking,
  services,
  onUpdate,
  onDelete,
  isSaving,
  getAccessToken
}: {
  booking: Booking;
  services: Service[];
  onUpdate: (id: number, data: BookingUpdatePayload) => void;
  onDelete: (id: number) => void;
  isSaving: boolean;
  getAccessToken: () => Promise<string | null>;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { toast } = useToast();
  const { data: bookingItems } = useBookingItems(booking.id, getAccessToken, isEditOpen);

  const handleStatusChange = (status: string) => {
    onUpdate(booking.id, { status });
    toast({ title: `Status changed to ${status}` });
  };

  const handlePaymentStatusChange = (paymentStatus: string) => {
    onUpdate(booking.id, { paymentStatus });
    toast({ title: `Payment status changed to ${paymentStatus}` });
  };

  return (
    <>
      <SharedBookingCard
        booking={booking}
        getAccessToken={getAccessToken}
        variant="interactive"
        onUpdateStatus={handleStatusChange}
        onUpdatePayment={handlePaymentStatusChange}
        onEdit={() => setIsEditOpen(true)}
        onDelete={() => onDelete(booking.id)}
      />

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
    </>
  );
}

export function BookingsSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const queryClient = useQueryClient();
  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['/api/bookings'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('GET', '/api/bookings', token);
      return res.json();
    },
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
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('PATCH', `/api/bookings/${id}`, token, updates);
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
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      await authenticatedRequest('DELETE', `/api/bookings/${id}`, token);
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
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage all customer bookings</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm font-semibold px-4 py-2 border-0 bg-muted dark:text-white">
            {filteredBookings.length} Total
          </Badge>
          <Select
            value={bookingView}
            onValueChange={(value) => setBookingView(value as 'upcoming' | 'past' | 'all')}
          >
            <SelectTrigger
              className="h-10 w-[150px] px-4 border-0 bg-muted text-sm font-semibold shadow-none"
              data-testid="select-bookings-view"
            >
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

      {/* Booking list or empty states */}
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
        <div className="space-y-3">
          {filteredBookings.map((booking) => (
            <InteractiveBookingCard
              key={booking.id}
              booking={booking}
              services={services}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              isSaving={updateMutation.isPending}
              getAccessToken={getAccessToken}
            />
          ))}
        </div>
      )}
    </div>
  );
}
