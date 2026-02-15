import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Building2, Calendar, Clock, DollarSign, Loader2 } from 'lucide-react';
export function AvailabilitySection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['/api/company-settings']
  });
  const availabilityMenuTitle = 'Availability & Business Hours';
  const TIMEZONE_OPTIONS = [
    { value: 'America/New_York', label: 'Eastern (America/New_York)' },
    { value: 'America/Chicago', label: 'Central (America/Chicago)' },
    { value: 'America/Denver', label: 'Mountain (America/Denver)' },
    { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
    { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
    { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
    { value: 'America/Honolulu', label: 'Hawaii (America/Honolulu)' },
    { value: 'America/Mexico_City', label: 'Mexico City (America/Mexico_City)' },
    { value: 'America/Sao_Paulo', label: 'Brazil (America/Sao_Paulo)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (America/Argentina/Buenos_Aires)' },
    { value: 'Europe/London', label: 'UK (Europe/London)' },
    { value: 'Europe/Paris', label: 'Europe Central (Europe/Paris)' },
  ];

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      return apiRequest('PUT', '/api/company-settings', newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update settings', description: error.message, variant: 'destructive' });
    }
  });

  const updateField = (field: string, value: any) => {
    if (!settings) return;
    updateSettingsMutation.mutate({ ...settings, [field]: value });
  };

  if (isLoading || !settings) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const DEFAULT_BUSINESS_HOURS = {
    monday: { isOpen: true, start: '08:00', end: '18:00' },
    tuesday: { isOpen: true, start: '08:00', end: '18:00' },
    wednesday: { isOpen: true, start: '08:00', end: '18:00' },
    thursday: { isOpen: true, start: '08:00', end: '18:00' },
    friday: { isOpen: true, start: '08:00', end: '18:00' },
    saturday: { isOpen: false, start: '08:00', end: '18:00' },
    sunday: { isOpen: false, start: '08:00', end: '18:00' }
  };

  const formatTimeDisplay = (time24: string) => {
    const timeFormat = settings.timeFormat || '12h';
    if (timeFormat === '24h') return time24;
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{availabilityMenuTitle}</h1>
        <p className="text-muted-foreground">Manage your working hours and time display preferences</p>
      </div>

      <div className="grid gap-6">
        <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Booking Constraints
          </h2>
          <div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="minimumBookingValue">Minimum Booking Value ($)</Label>
              <Input
                id="minimumBookingValue"
                type="number"
                min="0"
                step="0.01"
                value={settings.minimumBookingValue || '0'}
                onChange={(e) => updateField('minimumBookingValue', e.target.value)}
                placeholder="0.00"
                data-testid="input-minimum-booking-value"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Customers must reach this cart total before proceeding to checkout. Set to 0 to disable.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Time Display & Hours
          </h2>
          <div className="space-y-6">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="timeFormat">Time Display Format</Label>
              <Select
                value={settings.timeFormat || '12h'}
                onValueChange={(value) => updateField('timeFormat', value)}
              >
                <SelectTrigger id="timeFormat">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how times are displayed in the booking calendar
              </p>
            </div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="timeZone">Business Time Zone</Label>
              <Select
                value={settings.timeZone || 'America/New_York'}
                onValueChange={(value) => updateField('timeZone', value)}
              >
                <SelectTrigger id="timeZone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for availability checks, chat dates, and calendar bookings
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Business Hours by Day</Label>
              <div className="space-y-3">
                {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                  const dayHours = (settings.businessHours || DEFAULT_BUSINESS_HOURS)[day];

                  return (
                    <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-card rounded-lg border border-border">
                      <div className="flex items-center justify-between sm:justify-start gap-3 sm:w-auto">
                        <div className="w-24 capitalize font-medium text-sm">{day}</div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={dayHours.isOpen}
                            onCheckedChange={(checked) => {
                              const newHours = { ...(settings.businessHours || DEFAULT_BUSINESS_HOURS) };
                              newHours[day] = { ...newHours[day], isOpen: checked };
                              updateField('businessHours', newHours);
                            }}
                          />
                          <span className="text-sm text-muted-foreground w-12">{dayHours.isOpen ? 'Open' : 'Closed'}</span>
                        </div>
                      </div>
                      {dayHours.isOpen && (
                        <div className="flex items-center gap-2 flex-1">
                          <Select
                            value={dayHours.start}
                            onValueChange={(value) => {
                              const newHours = { ...(settings.businessHours || DEFAULT_BUSINESS_HOURS) };
                              newHours[day] = { ...newHours[day], start: value };
                              updateField('businessHours', newHours);
                            }}
                          >
                            <SelectTrigger className="w-full sm:w-32">
                              <SelectValue>{formatTimeDisplay(dayHours.start)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, h) => (
                                <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                                  {formatTimeDisplay(`${h.toString().padStart(2, '0')}:00`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground shrink-0">to</span>
                          <Select
                            value={dayHours.end}
                            onValueChange={(value) => {
                              const newHours = { ...(settings.businessHours || DEFAULT_BUSINESS_HOURS) };
                              newHours[day] = { ...newHours[day], end: value };
                              updateField('businessHours', newHours);
                            }}
                          >
                            <SelectTrigger className="w-full sm:w-32">
                              <SelectValue>{formatTimeDisplay(dayHours.end)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, h) => (
                                <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                                  {formatTimeDisplay(`${h.toString().padStart(2, '0')}:00`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Set different business hours for each day of the week. Days marked as closed won't show any available time slots.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


