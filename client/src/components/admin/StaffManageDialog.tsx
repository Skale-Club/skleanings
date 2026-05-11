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
import { Loader2, Trash2 } from 'lucide-react';
import { CalendarTab } from '@/components/admin/CalendarTab';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface AvailabilityRow {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
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
  const [rows, setRows] = useState<AvailabilityRow[]>(() =>
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      isAvailable: i >= 1 && i <= 5,
      startTime: '09:00',
      endTime: '17:00',
    }))
  );

  const { data: availability, isLoading } = useQuery<AvailabilityRow[]>({
    queryKey: ['/api/staff', staffId, 'availability'],
    queryFn: () => fetch(`/api/staff/${staffId}/availability`).then((r) => r.json()),
  });

  useEffect(() => {
    if (availability) {
      setRows(
        Array.from({ length: 7 }, (_, i) => {
          const found = availability.find((a) => a.dayOfWeek === i);
          return found
            ? { dayOfWeek: i, isAvailable: found.isAvailable, startTime: found.startTime, endTime: found.endTime }
            : { dayOfWeek: i, isAvailable: i >= 1 && i <= 5, startTime: '09:00', endTime: '17:00' };
        })
      );
    }
  }, [availability]);

  const saveAvailability = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/api/staff/${staffId}/availability`, rows);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', staffId, 'availability'] });
      toast({ title: 'Availability updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update availability', description: error.message, variant: 'destructive' });
    },
  });

  const updateRow = (dayOfWeek: number, patch: Partial<AvailabilityRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r))
    );
  };

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
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.dayOfWeek} className="grid grid-cols-[3rem_1fr_auto_auto] gap-3 items-center">
            <span className="text-sm font-medium text-muted-foreground w-10">
              {DAY_NAMES[row.dayOfWeek]}
            </span>
            <Switch
              checked={row.isAvailable}
              onCheckedChange={(checked) => updateRow(row.dayOfWeek, { isAvailable: checked })}
            />
            <Input
              type="time"
              value={row.startTime}
              disabled={!row.isAvailable}
              onChange={(e) => updateRow(row.dayOfWeek, { startTime: e.target.value })}
              className="w-28 text-sm"
            />
            <Input
              type="time"
              value={row.endTime}
              disabled={!row.isAvailable}
              onChange={(e) => updateRow(row.dayOfWeek, { endTime: e.target.value })}
              className="w-28 text-sm"
            />
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

