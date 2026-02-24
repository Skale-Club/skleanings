import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { Booking, Category, Service } from '@shared/schema';
import { authenticatedRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, ChevronDown, Clock, DollarSign, FolderOpen, Loader2, MapPin, Package } from 'lucide-react';

export function DashboardSection({ goToBookings, getAccessToken }: { goToBookings: () => void; getAccessToken: () => Promise<string | null> }) {
  const { data: categories } = useQuery<Category[]>({ queryKey: ['/api/categories'] });
  const { data: services } = useQuery<Service[]>({ queryKey: ['/api/services'] });
  const { data: bookings } = useQuery<Booking[]>({
    queryKey: ['/api/bookings'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('GET', '/api/bookings', token);
      return res.json();
    },
  });
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
    { label: 'Categories', value: categories?.length || 0, icon: FolderOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Services', value: services?.length || 0, icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Bookings', value: bookings?.length || 0, icon: Calendar, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    {
      label: 'Total Revenue',
      value: `$${bookings?.reduce((sum, b) => sum + Number(b.totalPrice), 0).toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your cleaning business</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">{stat.label}</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{stat.value}</p>
                </div>
                <div className={clsx('w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0', stat.bg)}>
                  <stat.icon className={clsx('w-5 h-5 sm:w-6 sm:h-6', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Recent Bookings
          </h2>
          <div className="flex items-center gap-2">
            <Select
              value={recentBookingsView}
              onValueChange={(value) => setRecentBookingsView(value as 'upcoming' | 'past' | 'all')}
            >
              <SelectTrigger
                className="h-9 w-[140px] text-xs border-0 bg-muted font-semibold"
                data-testid="select-recent-bookings-view"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={goToBookings}>
              Go to Bookings
            </Button>
          </div>
        </div>

        {/* Booking cards */}
        {bookings?.length === 0 ? (
          <div className="p-10 text-center rounded-lg bg-card border border-border">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No bookings yet</p>
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="p-10 text-center rounded-lg bg-card border border-border">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No bookings in this view</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <SharedBookingCard key={booking.id} booking={booking} getAccessToken={getAccessToken} variant="readonly" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { SharedBookingCard } from '@/components/admin/shared/SharedBookingCard';
