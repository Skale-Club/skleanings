import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { StaffMember } from '@shared/schema';

// Local copy of formatTime — avoids any import back into BookingPage.tsx
function formatTime(time24: string, timeFormat: string): string {
  if (timeFormat === '24h') return time24;
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

interface StepTimeSlotProps {
  selectedDate: string;
  selectedTime: string;
  viewDate: Date;
  slots: Array<{ time: string; available: boolean }> | undefined;
  monthAvailability: Record<string, boolean> | undefined;
  isSlotsPending: boolean;
  isMonthAvailabilityPending: boolean;
  staffBySlot: Map<string, StaffMember[]>;
  staffCount: number;
  timeFormat: string;
  language?: string;
  dateFormat?: string;
  itemsWithDurations: any[];
  selectedDurations: Record<number, any>;
  allDurationsSelected: boolean;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
  onViewDateChange: (date: Date) => void;
  onDurationSelect: (svcId: number, duration: any) => void;
  onApplyDurations: () => void;
}

export function StepTimeSlot({
  selectedDate,
  selectedTime,
  viewDate,
  slots,
  monthAvailability,
  isSlotsPending,
  isMonthAvailabilityPending,
  staffBySlot,
  staffCount,
  timeFormat,
  language,
  dateFormat,
  itemsWithDurations,
  selectedDurations,
  allDurationsSelected,
  onSelectDate,
  onSelectTime,
  onViewDateChange,
  onDurationSelect,
  onApplyDurations,
}: StepTimeSlotProps): JSX.Element {
  const dateFnsLocale = language === 'pt-BR' ? ptBR : enUS;
  return (
    <>
      {/* DURATION SELECTOR — rendered before calendar when services have durations */}
      {itemsWithDurations.length > 0 && !allDurationsSelected && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-2xl font-bold mb-2">Choose Your Duration</h2>
          <p className="text-slate-500 text-sm mb-6">Select how long you need for each service.</p>
          <div className="space-y-6">
            {itemsWithDurations.map((svc: any) => (
              <div key={svc.id}>
                <p className="font-semibold mb-3 text-slate-800">{svc.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {svc.durations.map((d: any) => (
                    <button
                      key={d.id}
                      onClick={() => onDurationSelect(svc.id, d)}
                      className={clsx(
                        "p-4 rounded-xl border-2 text-left transition-all",
                        selectedDurations[svc.id]?.id === d.id
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <p className="font-semibold text-sm">{d.label}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        {Math.floor(d.durationMinutes / 60)}h {d.durationMinutes % 60 > 0 ? `${d.durationMinutes % 60}m ` : ''}— ${Number(d.price).toFixed(2)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            disabled={!allDurationsSelected}
            onClick={onApplyDurations}
            className="mt-6 w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Continue to Schedule <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 3: SCHEDULE */}
      {(allDurationsSelected || itemsWithDurations.length === 0) && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 text-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Calendar Column */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => onViewDateChange(subMonths(viewDate, 1))}
                  className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors border border-gray-100"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-bold text-slate-900">{format(viewDate, "MMMM yyyy", { locale: dateFnsLocale })}</h3>
                <button
                  onClick={() => onViewDateChange(addMonths(viewDate, 1))}
                  className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors border border-gray-100"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-4">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="text-center text-xs font-bold text-slate-400 py-2 uppercase tracking-wider">
                    {day.substring(0, 3)}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {(() => {
                  const monthStart = startOfMonth(viewDate);
                  const monthEnd = endOfMonth(monthStart);
                  const startDate = startOfWeek(monthStart);
                  const endDate = endOfWeek(monthEnd);
                  const rows = [];
                  let days = [];
                  let day = startDate;

                  while (day <= endDate) {
                    for (let i = 0; i < 7; i++) {
                      const currentDay = day;
                      const isCurrentMonth = isSameMonth(currentDay, monthStart);
                      const dateStr = format(currentDay, "yyyy-MM-dd");
                      const isSelected = selectedDate === dateStr;
                      const isToday = isSameDay(currentDay, new Date());
                      const isPast = currentDay < new Date() && !isToday;

                      const isAvailable = !isMonthAvailabilityPending && monthAvailability ? monthAvailability[dateStr] === true : false;

                      days.push(
                        <div key={currentDay.toString()} className="flex justify-center items-center aspect-square p-0.5">
                          <button
                            disabled={!isCurrentMonth || isPast || !isAvailable || isMonthAvailabilityPending}
                            onClick={() => {
                              onSelectDate(dateStr);
                            }}
                            className={clsx(
                              "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all relative shrink-0",
                              !isCurrentMonth && "opacity-0 cursor-default",
                              (isPast || !isAvailable) && isCurrentMonth && "text-slate-200 cursor-not-allowed opacity-40",
                              isCurrentMonth && !isPast && isAvailable && !isSelected && "text-slate-600 hover:bg-slate-50 hover:text-primary border border-transparent",
                              isSelected && isAvailable && "bg-primary text-white shadow-md shadow-primary/20",
                              isToday && !isSelected && isAvailable && "text-primary border-primary/30 bg-primary/5"
                            )}
                          >
                            {format(currentDay, "d")}
                          </button>
                        </div>
                      );
                      day = addDays(day, 1);
                    }
                    rows.push(days);
                    days = [];
                  }
                  return rows;
                })()}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-sm text-slate-400">
                <Clock className="w-4 h-4" />
                <span>Time zone: GMT-05:00 America/New_York (EST)</span>
              </div>
            </div>

            {/* Slots Column */}
            <div className="relative max-h-[440px] overflow-y-auto">
              <div className="space-y-3">
                {isSlotsPending ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-14 bg-slate-50 border border-slate-100 rounded-xl animate-pulse"></div>
                  ))
                ) : slots && slots.some(s => s.available) ? (
                  <div className="grid grid-cols-1 gap-3">
                    {slots
                      .filter((slot) => slot.available)
                      .map((slot) => {
                        const availableStaff = staffBySlot.get(slot.time) ?? [];
                        return (
                          <div key={slot.time} className="px-1 py-1">
                            <button
                              onClick={() => onSelectTime(slot.time)}
                              className={clsx(
                                "w-full py-4 px-6 rounded-xl font-bold transition-all border text-center",
                                selectedTime === slot.time
                                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.01]"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5"
                              )}
                            >
                              <div className="text-sm">{formatTime(slot.time, timeFormat)}</div>
                              {staffCount > 1 && availableStaff.length > 0 && (
                                <div className="flex flex-wrap justify-center gap-1 mt-2">
                                  {availableStaff.map((member) => (
                                    <span
                                      key={member.id}
                                      className={clsx(
                                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                        selectedTime === slot.time
                                          ? "bg-white/20 text-white"
                                          : "bg-slate-100 text-slate-600"
                                      )}
                                    >
                                      {member.firstName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                    <p className="text-slate-400 text-sm font-medium">
                      {selectedDate ? (slots && slots.length > 0 ? "No slots available for this date" : "No available slots for this duration.") : "Select a date to view available times."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
