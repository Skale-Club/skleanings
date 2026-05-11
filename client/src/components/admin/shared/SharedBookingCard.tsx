import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { Calendar, ChevronDown, Clock, ExternalLink, Loader2, MapPin, Pencil, Trash2, User } from 'lucide-react';
import type { Booking, StaffMember } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { Textarea } from '@/components/ui/textarea';
import { authenticatedRequest } from '@/lib/queryClient';

interface BookingItem {
    id: number;
    bookingId: number;
    serviceId: number;
    serviceName: string;
    quantity?: number;
    price: string;
}

export function useBookingItems(bookingId: number, getAccessToken: () => Promise<string | null>, enabled: boolean = true) {
    return useQuery<BookingItem[]>({
        queryKey: ['/api/bookings', bookingId, 'items'],
        queryFn: async () => {
            const token = await getAccessToken();
            const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(`/api/bookings/${bookingId}/items`, { headers });
            return res.json();
        },
        enabled,
    });
}

interface SharedBookingCardProps {
    booking: Booking;
    getAccessToken: () => Promise<string | null>;
    variant?: 'readonly' | 'interactive';
    onUpdateStatus?: (status: string) => void;
    onUpdatePayment?: (paymentStatus: string) => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

export function SharedBookingCard({
    booking,
    getAccessToken,
    variant = 'readonly',
    onUpdateStatus,
    onUpdatePayment,
    onEdit,
    onDelete,
}: SharedBookingCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const { data: bookingItems, isLoading } = useBookingItems(booking.id, getAccessToken, expanded);
    const queryClient = useQueryClient();

    const initials = (booking.customerName || '?')
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const statusColor = {
        pending: 'bg-warning/15 text-warning border-warning/30',
        confirmed: 'bg-primary/15 text-primary border-primary/30',
        completed: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
        cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
        awaiting_approval: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    }[booking.status] ?? 'bg-muted text-muted-foreground border-border';

    const approveMutation = useMutation({
        mutationFn: async () => {
            const token = await getAccessToken();
            if (!token) throw new Error('Authentication required');
            const res = await authenticatedRequest('PUT', `/api/bookings/${booking.id}/approve`, token);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async (reason: string) => {
            const token = await getAccessToken();
            if (!token) throw new Error('Authentication required');
            const res = await authenticatedRequest('PUT', `/api/bookings/${booking.id}/reject`, token, { reason });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
            setRejectDialogOpen(false);
            setRejectReason('');
        },
    });

    return (
        <Card className="overflow-hidden border border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-0">
                {/* Main row */}
                <div className="flex flex-col lg:flex-row lg:items-stretch">

                    {/* Avatar + Customer info */}
                    <div className="flex items-start gap-5 p-5 lg:p-6 lg:w-[280px] lg:shrink-0">
                        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 select-none">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-foreground leading-snug">{booking.customerName}</p>
                            {booking.customerEmail && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">{booking.customerEmail}</p>
                            )}
                            {booking.customerPhone && (
                                <p className="text-xs text-muted-foreground mt-0.5">{booking.customerPhone}</p>
                            )}
                        </div>
                    </div>

                    {/* Vertical divider */}
                    <div className="hidden lg:block w-px bg-border/50 my-4 shrink-0" />
                    <div className="block lg:hidden h-px w-full bg-border/50 shrink-0" />

                    {/* Schedule + Address */}
                    <div className="flex flex-col justify-center gap-3 p-5 lg:px-5 lg:py-5 lg:flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-foreground whitespace-nowrap">
                                    {format(new Date(booking.bookingDate), 'MMM dd, yyyy')}
                                </span>
                            </div>
                            <span className="hidden sm:inline text-muted-foreground shrink-0">·</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground text-xs whitespace-nowrap">
                                    {booking.startTime} – {booking.endTime}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                            <span className="line-clamp-2 leading-snug">{booking.customerAddress}</span>
                        </div>
                        {booking.staffMemberId && (
                            <StaffBadge staffMemberId={booking.staffMemberId} />
                        )}
                    </div>

                    {/* Vertical divider */}
                    <div className="hidden lg:block w-px bg-border/50 my-4 shrink-0" />
                    <div className="block lg:hidden h-px w-full bg-border/50 shrink-0" />

                    {/* Right side interactions based on variant */}
                    {variant === 'readonly' ? (
                        <div className="flex lg:flex-col items-center justify-between lg:justify-center gap-3 p-5 lg:px-8 lg:py-5 lg:w-[260px] lg:shrink-0">
                            <p className="text-xl font-bold text-foreground">${booking.totalPrice}</p>
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end lg:justify-center">
                                <span className={clsx(
                                    'text-xs font-semibold px-2.5 py-1 rounded-full border capitalize',
                                    statusColor
                                )}>
                                    {booking.status}
                                </span>
                                <span className={clsx(
                                    'text-xs font-semibold px-2.5 py-1 rounded-full border',
                                    booking.paymentStatus === 'paid'
                                        ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                        : booking.paymentStatus === 'pending_payment'
                                            ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                                            : 'bg-muted text-muted-foreground border-border'
                                )}>
                                    {booking.paymentStatus === 'paid'
                                        ? 'Paid'
                                        : booking.paymentStatus === 'pending_payment'
                                            ? 'Awaiting Payment'
                                            : 'Unpaid'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Interactive Status Dropdowns */}
                            <div className="flex sm:flex-col justify-center gap-3 p-5 lg:px-5 lg:py-5 lg:w-[170px] lg:shrink-0">
                                <Select value={booking.status} onValueChange={onUpdateStatus}>
                                    <SelectTrigger className="h-9 text-xs w-full" data-testid={`select-status-${booking.id}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">
                                            <span className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-warning/70" />
                                                Pending
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="confirmed">
                                            <span className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-primary/70" />
                                                Confirmed
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="completed">
                                            <span className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
                                                Completed
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="cancelled">
                                            <span className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-destructive/70" />
                                                Cancelled
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="awaiting_approval">
                                            <span className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                                                Awaiting Approval
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={booking.paymentStatus} onValueChange={onUpdatePayment}>
                                    <SelectTrigger className="h-9 text-xs w-full" data-testid={`select-payment-${booking.id}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="paid">
                                            <span className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
                                                Paid
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="pending_payment">
                                            <span className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                                                Awaiting Payment
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="unpaid">
                                            <span className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                                                Unpaid
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Vertical divider */}
                            <div className="hidden lg:block w-px bg-border/50 my-4 shrink-0" />

                            {/* Amount + Actions */}
                            <div className="flex lg:flex-col items-center justify-between lg:justify-center gap-3 p-5 lg:px-5 lg:py-5 lg:w-[140px] lg:shrink-0">
                                <div className="text-center">
                                    <p className="text-xs text-muted-foreground mb-0.5">Amount</p>
                                    <p
                                        className="text-xl font-bold text-foreground"
                                        data-testid={`text-amount-${booking.id}`}
                                    >
                                        ${booking.totalPrice}
                                    </p>
                                </div>

                                {/* Approve/Reject buttons — only for awaiting_approval bookings */}
                                {booking.status === 'awaiting_approval' && (
                                    <div className="flex flex-col gap-1.5 w-full">
                                        <Button
                                            size="sm"
                                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                                            onClick={() => approveMutation.mutate()}
                                            disabled={approveMutation.isPending}
                                            data-testid={`button-approve-booking-${booking.id}`}
                                        >
                                            {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                            Approve
                                        </Button>

                                        <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 text-xs border-destructive text-destructive hover:bg-destructive/10 w-full"
                                                    data-testid={`button-reject-booking-${booking.id}`}
                                                >
                                                    Reject
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Reject this booking?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        The booking will be cancelled. You can optionally provide a reason.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <div className="py-2">
                                                    <Textarea
                                                        placeholder="Reason (optional)"
                                                        value={rejectReason}
                                                        onChange={(e) => setRejectReason(e.target.value)}
                                                        className="resize-none"
                                                        rows={3}
                                                    />
                                                </div>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        className="bg-destructive hover:bg-destructive/90"
                                                        onClick={() => rejectMutation.mutate(rejectReason)}
                                                        disabled={rejectMutation.isPending}
                                                    >
                                                        {rejectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1 inline" /> : null}
                                                        Reject booking
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                )}

                                <div className="flex items-center gap-0.5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onEdit?.()}
                                        data-testid={`button-edit-booking-${booking.id}`}
                                        aria-label="Edit booking"
                                    >
                                        <Pencil className="w-4 h-4 text-muted-foreground" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onDelete?.()}
                                        data-testid={`button-delete-booking-${booking.id}`}
                                        aria-label="Delete booking"
                                    >
                                        <Trash2 className="w-4 h-4 text-destructive/70" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}

                </div>

                {/* Footer: services toggle */}
                <div className="border-t border-border/50 px-5 py-2 flex items-center justify-between bg-muted/20">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setExpanded((prev) => !prev)}
                        data-testid={`button-toggle-recent-booking-${booking.id}`}
                    >
                        <ChevronDown className={clsx('w-3.5 h-3.5 mr-1 transition-transform', expanded && 'rotate-180')} />
                        {expanded ? 'Hide services' : 'Show services'}
                    </Button>
                    <div className="flex items-center gap-3">
                        {booking.stripeSessionId && (
                            <a
                                href={
                                    booking.stripeSessionId.startsWith('cs_test_')
                                        ? `https://dashboard.stripe.com/test/payments/${booking.stripeSessionId}`
                                        : `https://dashboard.stripe.com/payments/${booking.stripeSessionId}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                title={booking.stripeSessionId}
                            >
                                <ExternalLink className="w-3 h-3" />
                                {booking.stripeSessionId.slice(0, 20)}…
                            </a>
                        )}
                        <span className="text-xs text-muted-foreground">#{booking.id}</span>
                    </div>
                </div>

                {/* Expanded services */}
                {expanded && (
                    <div className="px-5 py-4 border-t border-border/50 bg-muted/10 space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Services
                        </h4>
                        {isLoading ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Loading...
                            </div>
                        ) : bookingItems && bookingItems.length > 0 ? (
                            <ul className="space-y-2">
                                {bookingItems.map((item) => (
                                    <li key={item.id} className="text-sm flex items-center justify-between">
                                        <span>
                                            {item.serviceName}
                                            {item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''}
                                        </span>
                                        <span className="font-medium text-foreground">${item.price}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No services listed</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StaffBadge({ staffMemberId }: { staffMemberId: number }) {
    const { data: member } = useQuery<StaffMember>({
        queryKey: ['/api/staff', staffMemberId],
        queryFn: () => fetch(`/api/staff/${staffMemberId}`).then(r => r.json()),
        staleTime: 60_000,
    });

    if (!member) return null;

    return (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="w-4 h-4 shrink-0" />
            <span>{member.firstName} {member.lastName}</span>
        </div>
    );
}
