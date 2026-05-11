import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { Service, StaffAvailabilityOverride } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { CalendarTab } from '@/components/admin/CalendarTab';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface RangeEntry {
  startTime: string;
  endTime: string;
}

interface DayState {
  isAvailable: boolean;
  ranges: RangeEntry[]; // ordered; index = rangeOrder
}

interface StaffManageDialogProps {
  staffId: number;
  staffName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StaffManageDialog({
  staffId,
  staffName,
  open,
  onOpenChange,
}: StaffManageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{staffName} — Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="services">
          <TabsList className="w-full">
            <TabsTrigger value="services" className="flex-1">Services</TabsTrigger>
            <TabsTrigger value="availability" className="flex-1">Availability</TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1">Calendar</TabsTrigger>
            <TabsTrigger value="overrides" className="flex-1">Overrides</TabsTrigger>
          </TabsList>
          <TabsContent value="services" className="mt-4">
            <ServicesTab staffId={staffId} />
          </TabsContent>
          <TabsContent value="availability" className="mt-4">
            <AvailabilityTab staffId={staffId} />
          </TabsContent>
          <TabsContent value="calendar" className="mt-4">
            <CalendarTab staffId={staffId} />
          </TabsContent>
          <TabsContent value="overrides" className="mt-4">
            <DateOverridesTab staffId={staffId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ServicesTab({ staffId }: { staffId: number }) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: allServices, isLoading: loadingAll } = useQuery<Service[]>({
    queryKey: ['/api/services'],
    queryFn: () => fetch('/api/services').then((r) => r.json()),
  });

  const { data: assignedServices, isLoading: loadingAssigned } = useQuery<Service[]>({
    queryKey: ['/api/staff', staffId, 'services'],
    queryFn: () => fetch(`/api/staff/${staffId}/services`).then((r) => r.json()),
  });

  useEffect(() => {
    if (assignedServices) {
      setSelectedIds(new Set(assignedServices.map((s) => s.id)));
    }
  }, [assignedServices]);

  const saveServices = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/api/staff/${staffId}/services`, {
        serviceIds: [...selectedIds],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', staffId, 'services'] });
      toast({ title: 'Services updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update services', description: error.message, variant: 'destructive' });
    },
  });

  const toggle = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  if (loadingAll || loadingAssigned) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select which services this staff member can perform.
      </p>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {allServices?.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No services found.</p>
        )}
        {allServices?.map((service) => (
          <div key={service.id} className="flex items-center gap-3 py-1.5">
            <Checkbox
              id={`svc-${service.id}`}
              checked={selectedIds.has(service.id)}
              onCheckedChange={(checked) => toggle(service.id, !!checked)}
            />
            <Label htmlFor={`svc-${service.id}`} className="cursor-pointer font-normal">
              {service.name}
            </Label>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <Button
          onClick={() => saveServices.mutate()}
          disabled={saveServices.isPending}
          data-testid="button-save-services"
        >
          {saveServices.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

function DateOverridesTab({ staffId }: { staffId: number }) {
  const { toast } = useToast();

  // Form state
  const [date, setDate] = useState('');
  const [isUnavailable, setIsUnavailable] = useState(true);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');

  // Fetch existing overrides
  const { data: overrides = [], isLoading } = useQuery<StaffAvailabilityOverride[]>({
    queryKey: ['/api/staff', staffId, 'availability-overrides'],
    queryFn: () => fetch(`/api/staff/${staffId}/availability-overrides`).then((r) => r.json()),
  });

  // Create override mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error('Select a date');
      if (!isUnavailable && startTime >= endTime) throw new Error('Start time must be before end time');
      return apiRequest('POST', `/api/staff/${staffId}/availability-overrides`, {
        date,
        isUnavailable,
        startTime: isUnavailable ? null : startTime,
        endTime: isUnavailable ? null : endTime,
        reason: reason.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', staffId, 'availability-overrides'] });
      setDate('');
      setReason('');
      toast({ title: 'Override saved' });
    },
    onError: (err: Error) => toast({ title: 'Failed to save', description: err.message, variant: 'destructive' }),
  });

  // Delete override mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest('DELETE', `/api/staff/${staffId}/availability-overrides/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', staffId, 'availability-overrides'] });
      toast({ title: 'Override removed' });
    },
    onError: (err: Error) => toast({ title: 'Failed to remove', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      {/* Add Override Form */}
      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-medium">Add Date Override</p>

        <div className="space-y-1">
          <Label htmlFor="override-date" className="text-xs">Date</Label>
          <Input
            id="override-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="override-unavailable"
            checked={isUnavailable}
            onCheckedChange={setIsUnavailable}
          />
          <Label htmlFor="override-unavailable" className="text-xs cursor-pointer">
            Block entire day (unavailable)
          </Label>
        </div>

        {!isUnavailable && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Start time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="override-reason" className="text-xs">Reason (optional)</Label>
          <Input
            id="override-reason"
            placeholder="e.g. Holiday, Doctor appointment"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <Button
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={!date || createMutation.isPending}
          className="w-full"
        >
          {createMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          Save Override
        </Button>
      </div>

      {/* Existing Overrides List */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : overrides.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No date overrides yet.</p>
      ) : (
        <ul className="space-y-2">
          {overrides.map((ov) => (
            <li key={ov.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{ov.date}</span>
                <span className="ml-2 text-muted-foreground">
                  {ov.isUnavailable
                    ? 'Unavailable'
                    : `${ov.startTime} – ${ov.endTime}`}
                </span>
                {ov.reason && (
                  <span className="ml-2 text-xs text-muted-foreground">({ov.reason})</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(ov.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AvailabilityTab({ staffId }: { staffId: number }) {
  const { toast } = useToast();
  const [days, setDays] = useState<DayState[]>([]);

  const { data: availability, isLoading } = useQuery<any[]>({
    queryKey: ['/api/staff', staffId, 'availability'],
    queryFn: () => fetch(`/api/staff/${staffId}/availability`).then((r) => r.json()),
  });

  useEffect(() => {
    if (!availability) return;
    const next: DayState[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
      const dayRows = (availability as any[])
        .filter((a) => a.dayOfWeek === dayOfWeek)
        .sort((a: any, b: any) => (a.rangeOrder ?? 0) - (b.rangeOrder ?? 0));
      if (dayRows.length === 0) {
        const defaultAvailable = dayOfWeek >= 1 && dayOfWeek <= 5;
        return { isAvailable: defaultAvailable, ranges: [{ startTime: '09:00', endTime: '17:00' }] };
      }
      const isAvailable = dayRows[0].isAvailable;
      const ranges: RangeEntry[] = isAvailable
        ? dayRows.map((r: any) => ({ startTime: r.startTime, endTime: r.endTime }))
        : [{ startTime: dayRows[0].startTime, endTime: dayRows[0].endTime }];
      return { isAvailable, ranges };
    });
    setDays(next);
  }, [availability]);

  const saveAvailability = useMutation({
    mutationFn: async () => {
      const payload = days.flatMap((day, dayOfWeek) => {
        if (!day.isAvailable) {
          return [{
            dayOfWeek,
            isAvailable: false,
            startTime: day.ranges[0]?.startTime ?? '09:00',
            endTime: day.ranges[0]?.endTime ?? '17:00',
            rangeOrder: 0,
          }];
        }
        return day.ranges.map((r, rangeOrder) => ({
          dayOfWeek,
          isAvailable: true,
          startTime: r.startTime,
          endTime: r.endTime,
          rangeOrder,
        }));
      });
      return apiRequest('PUT', `/api/staff/${staffId}/availability`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', staffId, 'availability'] });
      toast({ title: 'Availability updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update availability', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set weekly working hours for this staff member.
      </p>
      <div className="space-y-3">
        {days.map((day, dayOfWeek) => (
          <div key={dayOfWeek} className="border rounded-lg p-3">
            {/* Day header row: checkbox + day name */}
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                id={`day-available-${dayOfWeek}`}
                checked={day.isAvailable}
                onChange={(e) =>
                  setDays((prev) => prev.map((d, i) =>
                    i === dayOfWeek ? { ...d, isAvailable: e.target.checked } : d
                  ))
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor={`day-available-${dayOfWeek}`} className="font-medium text-sm cursor-pointer">
                {DAY_NAMES[dayOfWeek]}
              </label>
            </div>

            {/* Range list — only render when day is available */}
            {day.isAvailable && (
              <div className="space-y-2 pl-6">
                {day.ranges.map((range, rangeIdx) => (
                  <div key={rangeIdx} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={range.startTime}
                      className="border rounded px-2 py-1 text-sm"
                      onChange={(e) =>
                        setDays((prev) => prev.map((d, di) =>
                          di !== dayOfWeek ? d : {
                            ...d,
                            ranges: d.ranges.map((r, ri) =>
                              ri === rangeIdx ? { ...r, startTime: e.target.value } : r
                            ),
                          }
                        ))
                      }
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={range.endTime}
                      className="border rounded px-2 py-1 text-sm"
                      onChange={(e) =>
                        setDays((prev) => prev.map((d, di) =>
                          di !== dayOfWeek ? d : {
                            ...d,
                            ranges: d.ranges.map((r, ri) =>
                              ri === rangeIdx ? { ...r, endTime: e.target.value } : r
                            ),
                          }
                        ))
                      }
                    />
                    {/* Remove range — only show when more than one range exists */}
                    {day.ranges.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() =>
                          setDays((prev) => prev.map((d, di) =>
                            di !== dayOfWeek ? d : {
                              ...d,
                              ranges: d.ranges.filter((_, ri) => ri !== rangeIdx),
                            }
                          ))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}

                {/* Add range button */}
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    setDays((prev) => prev.map((d, di) =>
                      di !== dayOfWeek ? d : {
                        ...d,
                        ranges: [...d.ranges, { startTime: '09:00', endTime: '17:00' }],
                      }
                    ))
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add range
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <Button
          onClick={() => saveAvailability.mutate()}
          disabled={saveAvailability.isPending}
          data-testid="button-save-availability"
        >
          {saveAvailability.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

