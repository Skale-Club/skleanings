/**
 * Recurring Booking Generator — Phase 27 RECUR-02
 *
 * Runs daily (via GitHub Actions in production, node-cron in local dev).
 * Finds active recurring subscriptions whose next_booking_date <= today,
 * generates the next booking occurrence, and advances next_booking_date.
 *
 * Design decisions:
 * - Uses raw db.transaction (not storage.createBooking) to bypass GHL/Twilio
 *   notifications for auto-generated future bookings (Phase 28 decides notification strategy).
 * - Atomic transaction: booking insert + next_booking_date advance happen together.
 *   If GitHub Actions retries, the subscription's next_booking_date is already advanced → skip.
 * - Per-subscription errors are caught and logged without crashing the run.
 */

import { db } from "../db";
import { storage } from "../storage";
import { bookings, recurringBookings } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface GenerationResult {
  checked: number;
  created: number;
  errors: Array<{ subscriptionId: number; error: string }>;
}

/**
 * Advance a YYYY-MM-DD date by intervalDays.
 * For monthly subscriptions (intervalDays=30) we use calendar-month addition
 * and clamp to the last day of month to avoid drift (Jan 31 → Feb 28 → Mar 31).
 */
function advanceDate(currentDate: string, intervalDays: number): string {
  const d = new Date(currentDate + "T00:00:00Z");

  if (intervalDays === 30) {
    // Monthly: add 1 calendar month then clamp to end-of-month if needed
    const originalDay = d.getUTCDate();
    d.setUTCMonth(d.getUTCMonth() + 1);
    // Clamp: if month overflow moved us (e.g. Jan 31 → Mar 2), back up to last day
    if (d.getUTCDate() !== originalDay) {
      d.setUTCDate(0); // rolls back to last day of previous month
    }
  } else {
    // Weekly (7) or biweekly (14): simple day addition
    d.setUTCDate(d.getUTCDate() + intervalDays);
  }

  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Compute end time given HH:MM start and total duration in minutes.
 */
function computeEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const totalMinutes = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export async function runRecurringBookingGeneration(
  asOfDateOverride?: string
): Promise<GenerationResult> {
  const today = asOfDateOverride ?? new Date().toISOString().slice(0, 10);

  const due = await storage.getActiveRecurringBookingsDueForGeneration(today);
  console.log(`[RecurringGen] ${due.length} subscription(s) due as of ${today}`);

  let created = 0;
  const errors: GenerationResult["errors"] = [];

  for (const sub of due) {
    try {
      await db.transaction(async (tx) => {
        // Re-check status inside transaction to guard against pause/cancel race
        const [fresh] = await tx
          .select({ status: recurringBookings.status })
          .from(recurringBookings)
          .where(eq(recurringBookings.id, sub.id))
          .limit(1);

        if (!fresh || fresh.status !== "active") {
          console.log(`[RecurringGen] Subscription ${sub.id} is no longer active — skipping`);
          return;
        }

        // Fetch the service to get duration and price defaults
        // (uses storage directly — getService is read-only so safe outside tx)
        const service = await storage.getService(sub.serviceId);
        if (!service || !service.durationMinutes) {
          throw new Error(`Service ${sub.serviceId} missing or has no durationMinutes`);
        }

        // Compute booking fields from the subscription snapshot
        const bookingDate = sub.nextBookingDate; // YYYY-MM-DD
        const startTime = sub.preferredStartTime; // HH:MM
        const durationMinutes = service.durationMinutes;
        const endTime = computeEndTime(startTime, durationMinutes);

        // Apply discount from snapshot
        const basePrice = parseFloat(service.price);
        const discount = parseFloat(sub.discountPercent ?? "0");
        const finalPrice = (basePrice * (1 - discount / 100)).toFixed(2);

        // Insert booking row — raw insert to bypass notification side-effects
        await tx.insert(bookings).values({
          customerName: "Recurring Booking", // Phase 28 will populate from contact
          customerEmail: null,
          customerPhone: "N/A",              // Phase 28 will populate from contact
          customerAddress: "N/A",            // Phase 28 will populate from contact
          bookingDate,
          startTime,
          endTime,
          totalDurationMinutes: durationMinutes,
          totalPrice: finalPrice,
          paymentMethod: "site",
          paymentStatus: "unpaid",
          status: "pending",
          staffMemberId: sub.preferredStaffMemberId ?? null,
          contactId: sub.contactId ?? null,
          recurringBookingId: sub.id,
        });

        // Advance next_booking_date — this is the idempotency key for retry safety
        const nextDate = advanceDate(sub.nextBookingDate, sub.intervalDays);
        await tx
          .update(recurringBookings)
          .set({ nextBookingDate: nextDate, updatedAt: new Date() })
          .where(eq(recurringBookings.id, sub.id));

        created++;
        console.log(
          `[RecurringGen] Created booking for subscription ${sub.id} on ${bookingDate}; next date: ${nextDate}`
        );
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[RecurringGen] Failed for subscription ${sub.id}:`, message);
      errors.push({ subscriptionId: sub.id, error: message });
    }
  }

  console.log(
    `[RecurringGen] Done — checked: ${due.length}, created: ${created}, errors: ${errors.length}`
  );
  return { checked: due.length, created, errors };
}
