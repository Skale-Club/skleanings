import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { Booking, Category, Service } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, ChevronDown, DollarSign, FolderOpen, Loader2, Package } from 'lucide-react';
export function DashboardSection({ goToBookings }: { goToBookings: () => void }) {
  const { data: categories } = useQuery<Category[]>({ queryKey: ['/api/categories'] });
  const { data: services } = useQuery<Service[]>({ queryKey: ['/api/services'] });
  const { data: bookings } = useQuery<Booking[]>({ queryKey: ['/api/bookings'] });
  const dashboardMenuTitle = 'Dashboard';
  const [recentBookingsView, setRecentBookingsView] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const recentBookings = useMemo(() => {
    const list = bookings || [];
    if (list.length === 0) return [];
    const now = new Date();

    const filtered = list.filter((booking) => {
      const time = booking.endTime || booking.startTime || '00:00';
      const dateTime = new Date(`${booking.bookingDate}T${time}`);
      const bookingIsPast = Number.isNaN(dateTime.getTime())
        ? new Date(booking.bookingDate) < now
        : dateTime < now;

      if (recentBookingsView === 'all') return true;
      if (recentBookingsView === 'past') return bookingIsPast;
      return !bookingIsPast;
    });

    return filtered.slice(0, 5);
  }, [bookings, recentBookingsView]);

  const stats = [
    { label: 'Total Categories', value: categories?.length || 0, icon: FolderOpen, color: 'text-blue-500' },
    { label: 'Total Services', value: services?.length || 0, icon: Package, color: 'text-green-500' },
    { label: 'Total Bookings', value: bookings?.length || 0, icon: Calendar, color: 'text-purple-500' },
    { label: 'Revenue', value: `$${bookings?.reduce((sum, b) => sum + Number(b.totalPrice), 0).toFixed(2) || '0.00'}`, icon: DollarSign, color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{dashboardMenuTitle}</h1>
        <p className="text-muted-foreground">Overview of your cleaning business</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-muted p-6 rounded-lg transition-all hover:bg-muted/80">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold text-foreground">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-card/70 flex items-center justify-center">
                <stat.icon className={clsx("w-6 h-6", stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted rounded-lg overflow-hidden">
        <div className="p-6 pb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Recent Bookings
          </h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select value={recentBookingsView} onValueChange={(value) => setRecentBookingsView(value as 'upcoming' | 'past' | 'all')}>
              <SelectTrigger className="h-9 w-full sm:w-[140px] text-xs bg-card/70 border-0 font-semibold" data-testid="select-recent-bookings-view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={goToBookings}>
              Go to Bookings
            </Button>
          </div>
        </div>
        <div className="px-6 pb-6">
          {bookings?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings yet</p>
          ) : recentBookings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings in this view</p>
          ) : (
            <div className="space-y-4">
              {recentBookings.map((booking) => (
                <RecentBookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


interface RecentBookingItem {
  id: number;
  serviceName: string;
  quantity?: number;
  price: string;
}

function useBookingItems(bookingId: number, enabled: boolean = true) {
  return useQuery<RecentBookingItem[]>({
    queryKey: ['/api/bookings', bookingId, 'items'],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/items`);
      return res.json();
    },
    enabled,
  });
}
function RecentBookingCard({ booking }: { booking: Booking }) {
  const [expanded, setExpanded] = useState(false);
  const { data: bookingItems, isLoading } = useBookingItems(booking.id, expanded);

  return (
    <div className="rounded-lg bg-card/70 dark:bg-slate-900/70 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium truncate">{booking.customerName}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(booking.bookingDate), "MMM dd, yyyy")} • {booking.startTime} - {booking.endTime}
          </p>
          <p className="text-xs text-muted-foreground truncate">{booking.customerAddress}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((prev) => !prev)}
            data-testid={`button-toggle-recent-booking-${booking.id}`}
          >
            <ChevronDown className={clsx("w-3.5 h-3.5 mr-1 transition-transform", expanded && "rotate-180")} />
            {expanded ? 'Hide services' : 'Show services'}
          </Button>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
          <p className="text-2xl sm:text-xl font-bold">${booking.totalPrice}</p>
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <Badge
              variant={booking.status === 'confirmed' ? 'default' : booking.status === 'completed' ? 'secondary' : 'destructive'}
              className="text-xs font-semibold leading-5 px-3 py-1 min-w-[88px] justify-center capitalize"
            >
              {booking.status}
            </Badge>
            <Badge
              className={`text-xs font-semibold leading-5 px-3 py-1 min-w-[88px] justify-center border ${booking.paymentStatus === 'paid'
                ? 'border-primary/30 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/20'
                : 'border-border bg-muted text-muted-foreground'
                }`}
            >
              {booking.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
            </Badge>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/60">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading services...
            </div>
          ) : bookingItems && bookingItems.length > 0 ? (
            <ul className="space-y-1">
              {bookingItems.map((item) => (
                <li key={item.id} className="text-xs flex items-center justify-between">
                  <span className="truncate">{item.serviceName}{item.quantity && item.quantity > 1 ? ` x${item.quantity}` : ''}</span>
                  <span className="font-medium text-foreground">${item.price}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">No services listed</p>
          )}
        </div>
      )}
    </div>
  );
}


