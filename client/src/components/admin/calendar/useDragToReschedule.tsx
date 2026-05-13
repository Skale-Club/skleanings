import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import type { StaffMember } from '@shared/schema';

interface CalendarEvent {
  bookingId: number;
  title: string;
  start: Date;
  end: Date;
  status: string;
  staffMemberId: number | null;
  color: string;
  isGcalBusy?: boolean;
}

interface UseDragToRescheduleProps {
  getAccessToken: () => Promise<string | null>;
  scopedStaffList: StaffMember[];
}

export function useDragToReschedule({ getAccessToken, scopedStaffList }: UseDragToRescheduleProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reassignMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      startTime: string;
      endTime: string;
      staffMemberId?: number | null;
    }) => {
      const { id, ...updates } = payload;
      const res = await apiRequest('PUT', `/api/bookings/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
  });

  const handleEventDrop = ({
    event,
    start,
    end,
    resourceId,
  }: {
    event: CalendarEvent;
    start: Date;
    end: Date;
    resourceId?: number;
  }) => {
    if (event.isGcalBusy) return;  // D-13: gcal blocks are not draggable

    const originalStart = event.start;
    const originalEnd = event.end;
    const originalStaffId = event.staffMemberId;

    const newStartTime = format(start, 'HH:mm');
    const newEndTime = format(end, 'HH:mm');
    // D-11: resourceId is the target staff column's id; fall back to original if not in By Staff view
    const newStaffId = resourceId !== undefined ? resourceId : event.staffMemberId;

    const staffName =
      scopedStaffList.find((s) => s.id === newStaffId)?.firstName ?? 'Staff';

    reassignMutation.mutate(
      {
        id: event.bookingId,
        startTime: newStartTime,
        endTime: newEndTime,
        staffMemberId: newStaffId,
      },
      {
        onSuccess: () => {
          // D-12: undo toast with 5-second window
          toast({
            description: `${staffName} — ${format(start, 'h:mm a')} ✓`,
            action: (
              <ToastAction
                altText="Undo"
                onClick={() => {
                  reassignMutation.mutate({
                    id: event.bookingId,
                    startTime: format(originalStart, 'HH:mm'),
                    endTime: format(originalEnd, 'HH:mm'),
                    staffMemberId: originalStaffId,
                  });
                }}
              >
                Undo
              </ToastAction>
            ),
            duration: 5000,
          });
        },
      },
    );
  };

  return { handleEventDrop };
}
