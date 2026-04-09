import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import type { Contact, Booking } from '@shared/schema';

type ContactWithStats = Contact & {
  bookingCount: number;
  totalSpend: number;
  lastBookingDate: string | null;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export function ContactsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: contacts, isLoading } = useQuery<ContactWithStats[]>({
    queryKey: ['/api/contacts', search],
    queryFn: async () => {
      const url = search ? `/api/contacts?search=${encodeURIComponent(search)}` : '/api/contacts';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch contacts');
      return res.json();
    },
  });

  const { data: contactDetail } = useQuery<Contact>({
    queryKey: ['/api/contacts', selectedId, 'detail'],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${selectedId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Contact not found');
      return res.json();
    },
    enabled: !!selectedId,
  });

  const { data: contactBookings } = useQuery<Booking[]>({
    queryKey: ['/api/contacts', selectedId, 'bookings'],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${selectedId}/bookings`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (contactDetail) setNotes(contactDetail.notes ?? '');
  }, [contactDetail]);

  const saveNotes = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contacts/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Failed to save notes');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: 'Notes saved' });
    },
    onError: () => {
      toast({ title: 'Failed to save notes', variant: 'destructive' });
    },
  });

  const sortedBookings = contactBookings
    ? [...contactBookings].sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold font-outfit">Contacts</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {contacts ? `${contacts.length} contacts` : 'Loading...'}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead>Last Booking</TableHead>
                <TableHead>GHL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : contacts && contacts.length > 0 ? (
                contacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${selectedId === contact.id ? 'bg-muted/30' : ''}`}
                    onClick={() => setSelectedId(contact.id)}
                  >
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.email ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.phone ?? '—'}</TableCell>
                    <TableCell className="text-right">{contact.bookingCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(contact.totalSpend))}</TableCell>
                    <TableCell>{formatDate(contact.lastBookingDate)}</TableCell>
                    <TableCell>
                      {contact.ghlContactId ? (
                        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs">GHL</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    {search ? 'No contacts match your search.' : 'No contacts yet. They are created automatically when bookings are made.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <span>{contactDetail?.name ?? 'Contact'}</span>
              {contactDetail?.ghlContactId && (
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs">GHL</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {!contactDetail ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile */}
              <div className="space-y-2 text-sm">
                {contactDetail.email && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Email</span>
                    <span>{contactDetail.email}</span>
                  </div>
                )}
                {contactDetail.phone && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Phone</span>
                    <span>{contactDetail.phone}</span>
                  </div>
                )}
                {contactDetail.address && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Address</span>
                    <span>{contactDetail.address}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Since</span>
                  <span>{formatDate(contactDetail.createdAt?.toString())}</span>
                </div>
                {contactDetail.ghlContactId && (
                  <div className="flex gap-2 items-center">
                    <span className="text-muted-foreground w-20 shrink-0">GHL ID</span>
                    <span className="font-mono text-xs text-muted-foreground truncate">{contactDetail.ghlContactId}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="contact-notes">Internal Notes</Label>
                <Textarea
                  id="contact-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add private notes about this contact..."
                  rows={4}
                  className="resize-none"
                />
                <Button
                  size="sm"
                  onClick={() => saveNotes.mutate()}
                  disabled={saveNotes.isPending}
                >
                  {saveNotes.isPending ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>

              {/* Booking History */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm">Booking History ({sortedBookings.length})</h3>
                {sortedBookings.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No bookings linked to this contact yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sortedBookings.map((booking) => (
                      <div key={booking.id} className="border rounded-lg p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{formatDate(booking.bookingDate)}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {booking.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{booking.startTime}</span>
                          <span className="font-medium text-foreground">{formatCurrency(Number(booking.totalPrice))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
