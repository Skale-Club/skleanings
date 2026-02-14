
import { storage } from "../storage";
import { getGHLFreeSlots } from "../integrations/ghl";
import { DEFAULT_BUSINESS_HOURS, type BusinessHours, type DayHours } from "@shared/schema";

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
    options?: { requireGhl?: boolean; timeZone?: string }
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
    const todayStr = tzNow.toISOString().split('T')[0];
    const isToday = date === todayStr;
    const currentHour = tzNow.getHours();
    const currentMinute = tzNow.getMinutes();

    const [startHr, startMn] = dayHours.start.split(':').map(Number);
    const [endHr, endMn] = dayHours.end.split(':').map(Number);

    const slots: string[] = [];

    for (let h = startHr; h < endHr || (h === endHr && 0 < endMn); h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === startHr && m < startMn) continue;
            if (h > endHr || (h === endHr && m >= endMn)) continue;

            const slotHour = h.toString().padStart(2, '0');
            const slotMinute = m.toString().padStart(2, '0');
            const startTime = `${slotHour}:${slotMinute}`;

            if (isToday) {
                if (h < currentHour || (h === currentHour && m <= currentMinute)) continue;
            }

            const slotDate = new Date(`2000-01-01T${startTime}:00`);
            slotDate.setMinutes(slotDate.getMinutes() + durationMinutes);
            if (slotDate.getHours() > endHr || (slotDate.getHours() === endHr && slotDate.getMinutes() > endMn)) {
                continue;
            }

            const endHour = slotDate.getHours().toString().padStart(2, '0');
            const endMinute = slotDate.getMinutes().toString().padStart(2, '0');
            const endTime = `${endHour}:${endMinute}`;

            let available = true;

            if (useGhl) {
                available = ghlFreeSlots.includes(startTime);
            }

            if (available) {
                available = !existingBookings.some(b => startTime < b.endTime && endTime > b.startTime);
            }

            if (available) {
                slots.push(startTime);
            }
        }
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
    excludeBookingId?: number
): Promise<boolean> {
    const existingBookings = await storage.getBookingsByDate(date);

    return !existingBookings.some(booking => {
        if (excludeBookingId && booking.id === excludeBookingId) return false;
        return (startTime < booking.endTime && endTime > booking.startTime);
    });
}
