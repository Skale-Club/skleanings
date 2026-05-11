/**
 * Recurring Booking Generator — Phase 27 RECUR-02 + Phase 28 fix
 *
 * Runs daily (via GitHub Actions in production, node-cron in local dev).
 * Finds active recurring subscriptions whose next_booking_date <= today,
 * generates the next booking occurrence, and advances next_booking_date.
 *
 * Design decisions:
 * - Uses raw db.transaction (not storage.createBooking) to bypass GHL/Twilio
 *   notifications for auto-generated future bookings.
 * - Atomic transaction: booking insert + next_booking_date advance happen together.
 *   If GitHub Actions retries, the subscription's next_booking_date is already advanced → skip.
 * - Per-subscription errors are caught and logged without crashing the run.
 * - Phase 28 fix: uses real contact data (name/email/phone/address) instead of placeholders.
 */

import { db } from "../db";
import { storage } from "../storage";
import { bookings, recurringBookings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { advanceDate } from "../lib/date-utils";

export interface GenerationResult {
  checked: number;
  created: number;
  errors: Array<{ subscriptionId: number; error: string }>;
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
        const service = await storage.getService(sub.serviceId);
        if (!service || !service.durationMinutes) {
          throw new Error(`Service ${sub.serviceId} missing or has no durationMinutes`);
        }

        // Phase 28 fix: fetch real contact data instead of using placeholders
        const contact = sub.contactId ? await storage.getContact(sub.contactId) : null;

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
        const [newBooking] = await tx.insert(bookings).values({
          customerName: contact?.name ?? "Recurring Booking",
          customerEmail: contact?.email ?? null,
          customerPhone: contact?.phone ?? "N/A",
          customerAddress: contact?.address ?? "N/A",
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
        } as any).returning({ id: bookings.id });

        if (!newBooking) throw new Error("Failed to insert booking row");

        // Advance the subscription's nextBookingDate atomically
        const nextDate = advanceDate(bookingDate, sub.intervalDays);
        await tx
          .update(recurringBookings)
          .set({ nextBookingDate: nextDate, updatedAt: new Date() })
          .where(eq(recurringBookings.id, sub.id));

        console.log(
          `[RecurringGen] Created booking ${newBooking.id} for subscription ${sub.id} on ${bookingDate}; next=${nextDate}`
        );
      });

      created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[RecurringGen] Error processing subscription ${sub.id}:`, message);
      errors.push({ subscriptionId: sub.id, error: message });
    }
  }

  return { checked: due.length, created, errors };
}
