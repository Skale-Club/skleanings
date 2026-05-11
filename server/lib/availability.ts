
import { storage } from "../storage";
import { getGHLFreeSlots } from "../integrations/ghl";
import { DEFAULT_BUSINESS_HOURS, type BusinessHours, type DayHours } from "@shared/schema";
import { type BookingLimits, shiftHHMM } from "./staff-availability";

export function getTodayStr(date: Date = new Date(), timeZone: string = 'America/New_York'): string {
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = tzFormatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '1970';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const day = parts.find(p => p.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
}

export function isTimeSlotAvailable(
    startTime: string,
    endTime: string,
    existingBookings: any[] // Using any[] to avoid circular dependency with storage types if possible, or import Booking
): boolean {
    return !existingBookings.some(b => startTime < b.endTime && endTime > b.startTime);
}

export async function getAvailabilityForDate(
    date: string,
    durationMinutes: number,
    useGhl: boolean,
    ghlSettings: any,
    options?: { requireGhl?: boolean; timeZone?: string },
    limits?: BookingLimits
) {
    const company = await storage.getCompanySettings();
    const businessHours: BusinessHours = (company?.businessHours as BusinessHours) || DEFAULT_BUSINESS_HOURS;
    const timeZone = options?.timeZone || company?.timeZone || 'America/New_York';
    const selectedDate = new Date(date + 'T12:00:00');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayName = dayNames[selectedDate.getDay()];
    const dayHours: DayHours = businessHours[dayName];

    if (!dayHours?.isOpen) return [];

    const existingBookings = await storage.getBookingsByDate(date);
    let ghlFreeSlots: string[] = [];

    if (useGhl && ghlSettings?.apiKey && ghlSettings.calendarId) {
        try {
            const startDate = new Date(date + 'T00:00:00');
            const endDate = new Date(date + 'T23:59:59');
            const result = await getGHLFreeSlots(
                ghlSettings.apiKey,
                ghlSettings.calendarId,
                startDate,
                endDate,
                timeZone
            );
            if (result.success && result.slots) {
                ghlFreeSlots = result.slots
                    .filter((slot: any) => slot.startTime?.startsWith(date))
                    .map((slot: any) => slot.startTime.split('T')[1]?.substring(0, 5))
                    .filter((t: string) => !!t);
            }
        } catch (error) {
            if (options?.requireGhl) {
                throw error;
            }
            // fall back silently
        }
    }

    const now = new Date();
    const tzNow = new Date(now.toLocaleString('en-US', { timeZone })); // Note: This creates a date object where getHours() returns time in timeZone

    const [startHr, startMn] = dayHours.start.split(':').map(Number);
    const [endHr, endMn] = dayHours.end.split(':').map(Number);

    const step = limits?.timeSlotInterval ?? durationMinutes;
    const dayStartMins = startHr * 60 + startMn;
    const dayEndMins = endHr * 60 + endMn;

    // Minimum-notice cutoff — use tzNow (already computed above) for TZ correctness
    const noticeMs = (limits?.minimumNoticeHours ?? 0) * 60 * 60 * 1000;
    const cutoffTs = tzNow.getTime() + noticeMs;

    const slots: string[] = [];

    for (let slotMins = dayStartMins; slotMins < dayEndMins; slotMins += step) {
        const slotH = Math.floor(slotMins / 60);
        const slotM = slotMins % 60;
        const startTime = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`;

        // Minimum notice check — skip if slot is within the cutoff window
        const slotTs = new Date(`${date}T${startTime}:00`).getTime();
        if (slotTs < cutoffTs) continue;

        const slotEndMins = slotMins + durationMinutes;
        if (slotEndMins > dayEndMins) continue;
        const endH = Math.floor(slotEndMins / 60);
        const endM = slotEndMins % 60;
        const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        let available = true;

        if (useGhl) {
            available = ghlFreeSlots.includes(startTime);
        }

        if (available) {
            const bufBefore = limits?.bufferTimeBefore ?? 0;
            const bufAfter = limits?.bufferTimeAfter ?? 0;
            available = !existingBookings.some((b) => {
                const occupiedStart = shiftHHMM(b.startTime, -bufBefore);
                const occupiedEnd = shiftHHMM(b.endTime, bufAfter);
                return startTime < occupiedEnd && endTime > occupiedStart;
            });
        }

        if (available) slots.push(startTime);
    }

    return slots;
}

export async function getAvailabilityRange(
    startDate: string,
    endDate: string,
    durationMinutes: number,
    options?: { useGhl?: boolean; ghlSettings?: any; requireGhl?: boolean; timeZone?: string }
) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return {};

    const result: Record<string, string[]> = {};
    const ghlSettings = options?.ghlSettings || await storage.getIntegrationSettings('gohighlevel');
    const useGhl = options?.useGhl ?? !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId);
    const timeZone = options?.timeZone;

    for (
        let cursor = new Date(start);
        cursor.getTime() <= end.getTime();
        cursor.setDate(cursor.getDate() + 1)
    ) {
        const dateStr = cursor.toISOString().split('T')[0];
        const slots = await getAvailabilityForDate(dateStr, durationMinutes, useGhl, ghlSettings, {
            requireGhl: options?.requireGhl,
            timeZone,
        });
        result[dateStr] = slots;
    }

    return result;
}

export async function checkAvailability(
    date: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: number,
    staffMemberId?: number
): Promise<boolean> {
    const existingBookings = staffMemberId
        ? await storage.getBookingsByDateAndStaff(date, staffMemberId)
        : await storage.getBookingsByDate(date);

    return !existingBookings.some(booking => {
        if (excludeBookingId && booking.id === excludeBookingId) return false;
        return (startTime < booking.endTime && endTime > booking.startTime);
    });
}
