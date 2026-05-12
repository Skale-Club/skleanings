/**
 * 24h email reminder service — Phase 31 EMAIL-03
 * Queries all bookings scheduled for tomorrow (status: confirmed | pending)
 * and sends a reminder email via Resend to each customer with an email address.
 */
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface ReminderRunResult {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
}

export async function run24hEmailReminders(): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { sent: 0, skipped: 0, failed: 0, total: 0 };

  // Check email is enabled before querying
  const emailCfg = await storage.getEmailSettings();
  if (!emailCfg?.enabled) {
    console.log('[EmailReminders] Email integration disabled — skipping run');
    return result;
  }

  // Query bookings for tomorrow (UTC date) with status confirmed or pending
  // Using raw SQL date arithmetic for Supabase/PostgreSQL compatibility
  const rows = (await db.execute(
    sql`SELECT b.id, b.customer_name, b.customer_email, b.booking_date, b.start_time,
               b.total_duration_minutes, b.customer_address
        FROM bookings b
        WHERE b.booking_date = (CURRENT_DATE + INTERVAL '1 day')::date
          AND b.status IN ('confirmed', 'pending')
          AND b.customer_email IS NOT NULL
          AND b.customer_email != ''`
  )) as unknown as Array<{
    id: number;
    customer_name: string;
    customer_email: string;
    booking_date: string;
    start_time: string;
    total_duration_minutes: number | null;
    customer_address: string | null;
  }>;

  result.total = rows.length;

  const companySettings = await storage.getCompanySettings();
  const { build24hReminderEmail } = await import('../lib/email-templates');
  const { sendResendEmail } = await import('../lib/email-resend');

  for (const row of rows) {
    try {
      // Get bookingItems to fetch durationLabel and serviceName
      const items = await storage.getBookingItems(row.id);
      const primaryItem = items[0];

      const content = build24hReminderEmail({
        customerName: row.customer_name,
        bookingDate: row.booking_date,
        startTime: row.start_time,
        serviceName: primaryItem?.serviceName ?? 'Cleaning Service',
        serviceAddress: row.customer_address ?? '',
        durationLabel: primaryItem?.durationLabel ?? null,
        durationMinutes: row.total_duration_minutes ?? (primaryItem?.durationMinutes ?? 60),
        companyName: companySettings?.companyName ?? 'Your Cleaning Service',
        logoUrl: companySettings?.logoMain ?? '',
      });

      await sendResendEmail(
        row.customer_email,
        content.subject,
        content.html,
        content.text,
        row.id,
        'appointment_reminder_24h'
      );
      result.sent++;
    } catch (err) {
      console.error(`[EmailReminders] Failed for booking ${row.id}:`, err);
      result.failed++;
    }
  }

  console.log(`[EmailReminders] 24h run complete:`, result);
  return result;
}
