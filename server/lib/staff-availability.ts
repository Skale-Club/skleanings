import type { IStorage } from "../storage";
import { getStaffBusyTimes } from "./google-calendar";

export interface BookingLimits {
  bufferTimeBefore: number;  // minutes
  bufferTimeAfter: number;   // minutes
  minimumNoticeHours: number;
  timeSlotInterval: number | null; // null = use durationMinutes
}

/** Add minutes to an HH:MM string. Negative values subtract. */
export function shiftHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(Math.max(0, total) / 60) % 24;
  const newM = Math.max(0, total) % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

interface SlotGenOptions {
  storage: IStorage;
  date: string;
  durationMinutes: number;
  limits?: BookingLimits;
  options?: { timeZone?: string };
  dayStartMins: number;
  dayEndMins: number;
  staffMemberId: number;
  prefetchedBookings?: Awaited<ReturnType<IStorage["getBookingsByDateAndStaff"]>>;
  prefetchedBusyTimes?: Array<{ start: string; end: string }>;
}

/**
 * Generate time slots for a staff member given already-resolved start/end minutes.
 * Checks booking conflicts, Google Calendar conflicts, minimum notice, and buffer times.
 */
async function _generateSlots(opts: SlotGenOptions): Promise<string[]> {
  const { storage, date, durationMinutes, limits, options, dayStartMins, dayEndMins, staffMemberId,
          prefetchedBookings, prefetchedBusyTimes } = opts;

  const existingBookings = prefetchedBookings
    ?? await storage.getBookingsByDateAndStaff(date, staffMemberId);

  // Google Calendar busy times (optional — returns [] if no calendar connected)
  const busyTimes = prefetchedBusyTimes
    ?? await getStaffBusyTimes(staffMemberId, date, options?.timeZone, storage);

  const timeZone = options?.timeZone || "America/New_York";
  const now = new Date();
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone }));
  const todayStr = getTodayStrForStaff(tzNow);
  const isToday = date === todayStr;

  // Minimum-notice cutoff — use tzNow for timezone correctness
  const noticeMs = (limits?.minimumNoticeHours ?? 0) * 60 * 60 * 1000;
  const cutoffTs = tzNow.getTime() + noticeMs;

  const step = limits?.timeSlotInterval ?? durationMinutes;

  const slots: string[] = [];

  for (let slotMins = dayStartMins; slotMins < dayEndMins; slotMins += step) {
    const slotH = Math.floor(slotMins / 60);
    const slotM = slotMins % 60;
    const startTime = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`;

    // Minimum notice check — compare slot datetime against tzNow-based cutoff
    const slotTs = new Date(`${date}T${startTime}:00`).getTime();
    if (slotTs < cutoffTs) continue;

    // For today without limits: also filter out past slots (legacy behaviour)
    if (isToday && limits === undefined) {
      const currentHour = tzNow.getHours();
      const currentMinute = tzNow.getMinutes();
      if (slotH < currentHour || (slotH === currentHour && slotM <= currentMinute)) continue;
    }

    const slotEndMins = slotMins + durationMinutes;
    if (slotEndMins > dayEndMins) continue;
    const endH = Math.floor(slotEndMins / 60);
    const endM = slotEndMins % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    // Buffer-aware conflict check
    const bufBefore = limits?.bufferTimeBefore ?? 0;
    const bufAfter = limits?.bufferTimeAfter ?? 0;
    const hasBookingConflict = existingBookings.some((b) => {
      const occupiedStart = shiftHHMM(b.startTime, -bufBefore);
      const occupiedEnd = shiftHHMM(b.endTime, bufAfter);
      return startTime < occupiedEnd && endTime > occupiedStart;
    });
    const hasGoogleConflict = busyTimes.some(
      (b) => startTime < b.end && endTime > b.start
    );
    if (!hasBookingConflict && !hasGoogleConflict) slots.push(startTime);
  }

  return slots;
}

/**
 * Compute available time slots for a specific staff member on a date.
 * Checks date-specific overrides first, then falls through to weekly schedule.
 * Uses the staff member's staffAvailability weekly schedule and their existing bookings.
 * If no availability record exists for that day of week, returns [].
 */
export async function getStaffAvailableSlots(
  storage: IStorage,
  staffMemberId: number,
  date: string,
  durationMinutes: number,
  options?: { timeZone?: string },
  limits?: BookingLimits
): Promise<string[]> {
  const dayOfWeek = new Date(date + "T12:00:00").getDay(); // 0=Sun … 6=Sat

  // Override check: date-specific block or custom hours take priority over weekly schedule
  const override = await storage.getStaffAvailabilityOverridesByDate(staffMemberId, date);
  if (override) {
    if (override.isUnavailable) return []; // whole day blocked
    if (override.startTime && override.endTime) {
      // Swap weekly hours for override hours
      const [startHr, startMn] = override.startTime.split(":").map(Number);
      const [endHr, endMn] = override.endTime.split(":").map(Number);
      const dayStartMins = startHr * 60 + startMn;
      const dayEndMins = endHr * 60 + endMn;
      return _generateSlots({
        storage, date, durationMinutes, limits, options,
        dayStartMins, dayEndMins, staffMemberId,
      });
    }
    // override exists but has no times and isUnavailable=false → treat as no override
  }

  const availability = await storage.getStaffAvailability(staffMemberId);
  const dayRecords = availability
    .filter((a) => a.dayOfWeek === dayOfWeek && a.isAvailable)
    .sort((a, b) => a.rangeOrder - b.rangeOrder);

  if (dayRecords.length === 0) return [];

  // Hoist DB calls outside the range loop — one fetch per date+staff, not one per range
  const [prefetchedBookings, prefetchedBusyTimes] = await Promise.all([
    storage.getBookingsByDateAndStaff(date, staffMemberId),
    getStaffBusyTimes(staffMemberId, date, options?.timeZone, storage),
  ]);

  const allSlots = new Set<string>();
  for (const record of dayRecords) {
    const [startHr, startMn] = record.startTime.split(":").map(Number);
    const [endHr, endMn] = record.endTime.split(":").map(Number);
    const rangeSlots = await _generateSlots({
      storage, date, durationMinutes, limits, options,
      dayStartMins: startHr * 60 + startMn,
      dayEndMins: endHr * 60 + endMn,
      staffMemberId,
      prefetchedBookings,
      prefetchedBusyTimes,
    });
    for (const slot of rangeSlots) allSlots.add(slot);
  }
  return [...allSlots].sort();
}

/** Helper to get today's date string from a timezone-adjusted Date object. */
function getTodayStrForStaff(tzNow: Date): string {
  // tzNow is already adjusted to business timezone via toLocaleString trick
  // Extract YYYY-MM-DD from the local date representation
  const y = tzNow.getFullYear();
  const mo = String(tzNow.getMonth() + 1).padStart(2, '0');
  const d = String(tzNow.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/**
 * Union: a slot is available if at least one active staff member is free.
 * Used when staff exist but no specific staffId or serviceIds are requested.
 */
export async function getStaffUnionSlots(
  storage: IStorage,
  date: string,
  durationMinutes: number,
  options?: { timeZone?: string }
): Promise<string[]> {
  const activeStaff = await storage.getStaffMembers(false);
  if (activeStaff.length === 0) return [];

  const slotSets = await Promise.all(
    activeStaff.map((s) => getStaffAvailableSlots(storage, s.id, date, durationMinutes, options))
  );

  const union = new Set<string>();
  for (const slots of slotSets) {
    for (const slot of slots) union.add(slot);
  }
  return [...union].sort();
}

/**
 * Intersection: for each service in the cart, at least one qualified + available staff must be free.
 * If staffId is provided, only that staff member is checked (qualification skipped).
 * Rule: if a staff member has no service abilities configured → they can do all services.
 */
export async function getSlotsForServices(
  storage: IStorage,
  date: string,
  durationMinutes: number,
  serviceIds: number[],
  staffId: number | undefined,
  options?: { timeZone?: string }
): Promise<string[]> {
  if (serviceIds.length === 0) {
    if (staffId) return getStaffAvailableSlots(storage, staffId, date, durationMinutes, options);
    return getStaffUnionSlots(storage, date, durationMinutes, options);
  }

  // STEP 1: Load booking limits from primary service — MUST be before if (staffId) fast-path
  let limits: BookingLimits | undefined;
  if (serviceIds.length > 0) {
    const primaryService = await storage.getService(serviceIds[0]);
    if (primaryService) {
      limits = {
        bufferTimeBefore: primaryService.bufferTimeBefore ?? 0,
        bufferTimeAfter: primaryService.bufferTimeAfter ?? 0,
        minimumNoticeHours: primaryService.minimumNoticeHours ?? 0,
        timeSlotInterval: primaryService.timeSlotInterval ?? null,
      };
    }
  }

  // STEP 2: Fast-path when a specific staffId is already known — now limits is defined
  if (staffId) {
    return getStaffAvailableSlots(storage, staffId, date, durationMinutes, options, limits);
  }

  // STEP 3: Union path — iterate all staff
  const activeStaff = await storage.getStaffMembers(false);
  if (activeStaff.length === 0) return [];

  // Build: staffId → Set of serviceIds they can perform (empty Set = unrestricted)
  const staffAbilities = new Map<number, Set<number>>();
  for (const staff of activeStaff) {
    const services = await storage.getServicesByStaffMember(staff.id);
    staffAbilities.set(staff.id, new Set(services.map((s) => s.id)));
  }

  // Compute available slots per staff member (with limits)
  const staffSlots = new Map<number, Set<string>>();
  for (const staff of activeStaff) {
    const slots = await getStaffAvailableSlots(storage, staff.id, date, durationMinutes, options, limits);
    staffSlots.set(staff.id, new Set(slots));
  }

  // Candidate slots = union across all staff
  const allSlots = new Set<string>();
  for (const slots of staffSlots.values()) {
    for (const slot of slots) allSlots.add(slot);
  }

  // Keep only slots where every service has at least one qualified + free staff member
  const result: string[] = [];
  for (const slot of [...allSlots].sort()) {
    let slotCoverable = true;
    for (const serviceId of serviceIds) {
      const hasCoverage = activeStaff.some((staff) => {
        const abilities = staffAbilities.get(staff.id)!;
        const canDoService = abilities.size === 0 || abilities.has(serviceId);
        const isFree = staffSlots.get(staff.id)!.has(slot);
        return canDoService && isFree;
      });
      if (!hasCoverage) {
        slotCoverable = false;
        break;
      }
    }
    if (slotCoverable) result.push(slot);
  }

  return result;
}
