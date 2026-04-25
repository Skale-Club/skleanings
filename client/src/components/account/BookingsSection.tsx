import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/context/AuthContext';
import { authenticatedRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { Booking } from '@shared/schema';
import { CancelBookingDialog } from './CancelBookingDialog';
import { RescheduleBookingDialog } from './RescheduleBookingDialog';

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending:   { label: 'Pending',   className: 'bg-yellow-100 text-yellow-800' },
    confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
    completed: { label: 'Completed', className: 'bg-slate-100 text-slate-600' },
  };
  const s = map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

function formatDate(bookingDate: string): string {
  return new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(t: string): string {
  const [hourStr, minuteStr] = t.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute} ${period}`;
}

function isEligibleForActions(booking: Booking): boolean {
  if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
  const today = new Date().toISOString().slice(0, 10);
  return booking.bookingDate >= today;
}

export function BookingsSection() {
  const { getAccessToken } = useAdminAuth();
  const queryClient = useQueryClient();

  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['/api/client/bookings'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      const res = await authenticatedRequest('GET', '/api/client/bookings', token);
      return res.json();
    },
  });

  const handleActionSuccess = () => {
    setCancelBooking(null);
    setRescheduleBooking(null);
    queryClient.invalidateQueries({ queryKey: ['/api/client/bookings'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center text-muted-foreground text-sm">
        No bookings found.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {bookings.map((booking) => (
          <div key={booking.id} className="bg-white rounded-lg border p-4 space-y-2">
            {/* Date + status badge */}
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">{formatDate(booking.bookingDate)}</span>
              {statusBadge(booking.status)}
            </div>

            {/* Time range + duration */}
            <p className="text-sm text-muted-foreground">
              {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
              {' · '}{booking.totalDurationMinutes} min
            </p>

            {/* Price + legacy indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">${Number(booking.totalPrice).toFixed(2)}</span>
              {booking.userId === null && (
                <span className="text-xs text-muted-foreground">Legacy booking</span>
              )}
            </div>

            {/* Action buttons — gated by eligibility */}
            {isEligibleForActions(booking) && (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setRescheduleBooking(booking)}>
                  Reschedule
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCancelBooking(booking)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {cancelBooking && (
        <CancelBookingDialog
          booking={cancelBooking}
          open={!!cancelBooking}
          onClose={() => setCancelBooking(null)}
          onSuccess={handleActionSuccess}
        />
      )}

      {rescheduleBooking && (
        <RescheduleBookingDialog
          booking={rescheduleBooking}
          open={!!rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onSuccess={handleActionSuccess}
        />
      )}
    </>
  );
}
