import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAvailability } from '@/hooks/use-booking';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Booking } from '@shared/schema';

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatTime(t: string): string {
  const [hourStr, minuteStr] = t.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute} ${period}`;
}

type Props = {
  booking: Booking;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function RescheduleBookingDialog({ booking, open, onClose, onSuccess }: Props) {
  const { getAccessToken } = useAdminAuth();
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedDate('');
      setSelectedTime('');
    }
  }, [open]);

  // Reset selected time when date changes
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedTime('');
  };

  const { data: slots, isLoading: isLoadingSlots } = useAvailability(
    selectedDate || undefined,
    booking.totalDurationMinutes,
  );

  const availableSlots = slots?.filter(s => s.available) ?? [];

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      const endTime = addMinutes(selectedTime, booking.totalDurationMinutes);
      const res = await fetch(`/api/client/bookings/${booking.id}/reschedule`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingDate: selectedDate, startTime: selectedTime, endTime }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to reschedule booking');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Booking rescheduled' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Reschedule failed', description: error.message, variant: 'destructive' });
    },
  });

  const canSubmit = !!selectedDate && !!selectedTime && !rescheduleMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Booking</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date picker */}
          <div className="space-y-1">
            <Label>New Date</Label>
            <input
              type="date"
              min={today}
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
              className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="space-y-2">
              <Label>Available Times</Label>
              {isLoadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading slots...
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available slots for this date.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedTime(slot.time)}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        selectedTime === slot.time
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input hover:bg-slate-50'
                      }`}
                    >
                      {formatTime(slot.time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={rescheduleMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => rescheduleMutation.mutate()} disabled={!canSubmit}>
            {rescheduleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {rescheduleMutation.isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
