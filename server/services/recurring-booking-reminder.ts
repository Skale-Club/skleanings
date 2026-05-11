/**
 * Recurring Booking Reminder Service — Phase 28 RECUR-03
 *
 * Finds bookings scheduled 48 hours from now that belong to an active recurring
 * subscription and sends a reminder email to the customer.
 *
 * Idempotency: bookingDate = reminderDate is a natural key — if the cron runs
 * once per day, each booking can only qualify on exactly one day. No sent-flag needed.
 * Risk: GitHub Actions retry on same day could double-send. Accepted for v4.0.
 * Mitigation: Cancelled subscriptions are excluded via recurringBookings.status join.
 */

import { db } from "../db";
import { storage } from "../storage";
import { bookings, recurringBookings } from "@shared/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { addDays, format } from "date-fns";
import { sendEmail } from "../lib/email";
import { buildReminderEmail } from "../lib/email-templates";

export interface ReminderResult {
  checked: number;
  sent: number;
  errors: Array<{ bookingId: number; error: string }>;
}

export async function runRecurringBookingReminders(
  asOfDateOverride?: string
): Promise<ReminderResult> {
  // Derive the target date: 2 days from today (UTC)
  const todayStr = asOfDateOverride ?? new Date().toISOString().slice(0, 10);
  // addDays from date-fns handles DST edge cases correctly
  const reminderDate = format(addDays(new Date(todayStr + "T00:00:00Z"), 2), "yyyy-MM-dd");

  console.log(`[ReminderService] Querying bookings for reminder date: ${reminderDate}`);

  // Find qualifying bookings:
  //   - bookingDate matches reminderDate (48h from now)
  //   - recurringBookingId IS NOT NULL (is a recurring booking)
  //   - booking.status != 'cancelled'
  //   - recurringBookings.status = 'active' (subscription not paused/cancelled)
  //   - customerEmail IS NOT NULL (can receive email)
  const dueBookings = await db
    .select({
      bookingId: bookings.id,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      startTime: bookings.startTime,
      recurringBookingId: bookings.recurringBookingId,
      frequencyName: recurringBookings.frequencyName,
      serviceId: recurringBookings.serviceId,
    })
    .from(bookings)
    .innerJoin(
      recurringBookings,
      eq(bookings.recurringBookingId, recurringBookings.id)
    )
    .where(
      and(
        eq(bookings.bookingDate, reminderDate),
        isNotNull(bookings.recurringBookingId),
        ne(bookings.status, "cancelled"),
        eq(recurringBookings.status, "active"),
        isNotNull(bookings.customerEmail)
      )
    );

  console.log(`[ReminderService] ${dueBookings.length} booking(s) due for reminder on ${reminderDate}`);

  // Fetch company name once for use in all emails
  let companyName = "Your Cleaning Company";
  try {
    const settings = await storage.getCompanySettings();
    companyName = settings?.companyName?.trim() || companyName;
  } catch {
    // Non-fatal: use default
  }

  let sent = 0;
  const errors: ReminderResult["errors"] = [];

  for (const row of dueBookings) {
    try {
      if (!row.customerEmail) continue; // type guard — already filtered but TS needs assurance

      // Fetch service name for the email template
      const service = await storage.getService(row.serviceId);
      if (!service) {
        console.warn(`[ReminderService] Service ${row.serviceId} not found for booking ${row.bookingId} — skipping`);
        continue;
      }

      const { subject, text, html } = buildReminderEmail({
        customerName: row.customerName,
        bookingDate: reminderDate,
        startTime: row.startTime,
        serviceName: service.name,
        companyName,
        frequencyName: row.frequencyName,
      });

      await sendEmail(row.customerEmail, subject, text, html);
      sent++;
      console.log(`[ReminderService] Reminder sent for booking ${row.bookingId} → ${row.customerEmail}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ReminderService] Failed for booking ${row.bookingId}:`, message);
      errors.push({ bookingId: row.bookingId, error: message });
    }
  }

  console.log(
    `[ReminderService] Done — checked: ${dueBookings.length}, sent: ${sent}, errors: ${errors.length}`
  );
  return { checked: dueBookings.length, sent, errors };
}
