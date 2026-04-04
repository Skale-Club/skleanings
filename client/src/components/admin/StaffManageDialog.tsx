import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { Service } from '@shared/schema';
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
import { Loader2 } from 'lucide-react';
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

