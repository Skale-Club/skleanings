import { storage } from "../storage";
import { getStaffBusyTimes } from "./google-calendar";

/**
 * Compute available time slots for a specific staff member on a date.
 * Uses the staff member's staffAvailability weekly schedule and their existing bookings.
 * If no availability record exists for that day of week, returns [].
 */
export async function getStaffAvailableSlots(
  staffMemberId: number,
  date: string,
  durationMinutes: number,
  options?: { timeZone?: string }
): Promise<string[]> {
  const dayOfWeek = new Date(date + "T12:00:00").getDay(); // 0=Sun … 6=Sat

  const availability = await storage.getStaffAvailability(staffMemberId);
  const dayRecord = availability.find((a) => a.dayOfWeek === dayOfWeek);

  if (!dayRecord || !dayRecord.isAvailable) return [];

  const [startHr, startMn] = dayRecord.startTime.split(":").map(Number);
  const [endHr, endMn] = dayRecord.endTime.split(":").map(Number);

  const existingBookings = await storage.getBookingsByDateAndStaff(date, staffMemberId);

  // Google Calendar busy times (optional — returns [] if no calendar connected)
  const busyTimes = await getStaffBusyTimes(staffMemberId, date, options?.timeZone);

  const timeZone = options?.timeZone || "America/New_York";
  const now = new Date();
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone }));
  const todayStr = tzNow.toISOString().split("T")[0];
  const isToday = date === todayStr;
  const currentHour = tzNow.getHours();
  const currentMinute = tzNow.getMinutes();

  const slots: string[] = [];

  for (let h = startHr; h < endHr || (h === endHr && 0 < endMn); h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === startHr && m < startMn) continue;
      if (h > endHr || (h === endHr && m >= endMn)) continue;

      const slotHour = h.toString().padStart(2, "0");
      const slotMinute = m.toString().padStart(2, "0");
      const startTime = `${slotHour}:${slotMinute}`;

      if (isToday) {
        if (h < currentHour || (h === currentHour && m <= currentMinute)) continue;
      }

      // Check slot end time fits within staff's window
      const slotEnd = new Date(`2000-01-01T${startTime}:00`);
      slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);
      if (
        slotEnd.getHours() > endHr ||
        (slotEnd.getHours() === endHr && slotEnd.getMinutes() > endMn)
      )
        continue;

      const endHour = slotEnd.getHours().toString().padStart(2, "0");
      const endMinute = slotEnd.getMinutes().toString().padStart(2, "0");
      const endTime = `${endHour}:${endMinute}`;

      const hasBookingConflict = existingBookings.some(
        (b) => startTime < b.endTime && endTime > b.startTime
      );
      const hasGoogleConflict = busyTimes.some(
        (b) => startTime < b.end && endTime > b.start
      );
      if (!hasBookingConflict && !hasGoogleConflict) slots.push(startTime);
    }
  }

  return slots;
}

/**
 * Union: a slot is available if at least one active staff member is free.
 * Used when staff exist but no specific staffId or serviceIds are requested.
 */
export async function getStaffUnionSlots(
  date: string,
  durationMinutes: number,
  options?: { timeZone?: string }
): Promise<string[]> {
  const activeStaff = await storage.getStaffMembers(false);
  if (activeStaff.length === 0) return [];

  const slotSets = await Promise.all(
    activeStaff.map((s) => getStaffAvailableSlots(s.id, date, durationMinutes, options))
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
  date: string,
  durationMinutes: number,
  serviceIds: number[],
  staffId: number | undefined,
  options?: { timeZone?: string }
): Promise<string[]> {
  if (serviceIds.length === 0) {
    if (staffId) return getStaffAvailableSlots(staffId, date, durationMinutes, options);
    return getStaffUnionSlots(date, durationMinutes, options);
  }

  if (staffId) {
    // Specific staff selected: availability is their own schedule only
    return getStaffAvailableSlots(staffId, date, durationMinutes, options);
  }

  const activeStaff = await storage.getStaffMembers(false);
  if (activeStaff.length === 0) return [];

  // Build: staffId → Set of serviceIds they can perform (empty Set = unrestricted)
  const staffAbilities = new Map<number, Set<number>>();
  for (const staff of activeStaff) {
    const services = await storage.getServicesByStaffMember(staff.id);
    staffAbilities.set(staff.id, new Set(services.map((s) => s.id)));
  }

  // Compute available slots per staff member
  const staffSlots = new Map<number, Set<string>>();
  for (const staff of activeStaff) {
    const slots = await getStaffAvailableSlots(staff.id, date, durationMinutes, options);
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
