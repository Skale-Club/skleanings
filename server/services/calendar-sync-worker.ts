/**
 * Calendar Sync Worker — Phase 32
 * Processes calendar_sync_queue rows with SELECT FOR UPDATE SKIP LOCKED.
 * Uses raw db.execute(sql`...`) — NOT Drizzle query builder (bug #3554 for SKIP LOCKED).
 * GCal jobs are gracefully skipped (marked success) until write scope is implemented.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import { storage } from "../storage";
import { syncBookingToGhl } from "../lib/booking-ghl-sync";

// Exponential backoff: attempt index → minutes to wait before next retry
// 6 total attempts → then failed_permanent
const BACKOFF_MINUTES = [1, 5, 30, 120, 720, 1440];

/**
 * Dispatch a single dequeued job row to its target handler.
 * Throws on failure — caller handles retry/permanent-failure logic.
 */
async function executeJob(job: Record<string, unknown>): Promise<void> {
  const target = job.target as string;
  const operation = job.operation as string;
  const bookingId = job.booking_id as number;

  if (target === 'google_calendar') {
    // GCal write is out of scope for Phase 32 (current OAuth scope is calendar.readonly).
    // Mark as success with a log note so the queue does not accumulate retries.
    console.log(`[CalendarSyncWorker] google_calendar job #${job.id} skipped — write scope not yet implemented. Marking success.`);
    return; // success path — caller marks success
  }

  if (target === 'ghl_contact' || target === 'ghl_appointment') {
    // Re-fetch booking from DB so worker always uses current data (not stale payload)
    const booking = await storage.getBooking(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found — may have been deleted`);
    }

    if (operation === 'create' || operation === 'update') {
      const result = await syncBookingToGhl(booking);
      if (result.attempted && !result.synced) {
        throw new Error(result.reason ?? 'GHL sync returned attempted=true but synced=false');
      }
      // If not attempted (GHL not configured), treat as success — no retry needed
      return;
    }

    if (operation === 'cancel') {
      // GHL cancellation: update appointment status if ghlAppointmentId exists
      // syncBookingToGhl does not handle cancel — log and treat as success for now
      // TODO: add cancelGhlAppointment() in a future phase
      console.log(`[CalendarSyncWorker] GHL cancel for booking ${bookingId} — no cancel handler yet; marking success`);
      return;
    }
  }

  throw new Error(`Unknown target '${target}' or operation '${operation}'`);
}

/**
 * Run one tick of the calendar sync worker.
 * Called by: POST /api/integrations/calendar-sync/cron/run (GitHub Actions every 5min)
 *            node-cron (local dev every 1min)
 */
export async function runCalendarSyncWorker(): Promise<{ processed: number; errors: number; reaped: number }> {
  let processed = 0;
  let errors = 0;
  let reaped = 0;

  // Step 1: Stale-row reaper — reset any in_progress rows stuck > 10 minutes
  // Handles crashed workers / Vercel function timeouts
  const reaperResult = (await db.execute(sql`
    UPDATE calendar_sync_queue
    SET
      status = 'pending',
      scheduled_for = NOW(),
      last_error = 'Reaped: stuck in_progress > 10 minutes'
    WHERE
      status = 'in_progress'
      AND last_attempt_at < NOW() - INTERVAL '10 minutes'
    RETURNING id
  `)) as unknown as Array<{ id: number }>;
  reaped = reaperResult.length;
  if (reaped > 0) {
    console.log(`[CalendarSyncWorker] Reaped ${reaped} stale in_progress row(s)`);
  }

  // Step 2: Atomic dequeue — single statement claims AND marks in_progress (no orphan risk)
  // CRITICAL: Uses raw SQL — Drizzle .for("update", {skipLocked:true}) is broken (bug #3554)
  const jobs = (await db.execute(sql`
    UPDATE calendar_sync_queue
    SET status = 'in_progress', last_attempt_at = NOW()
    WHERE id IN (
      SELECT id FROM calendar_sync_queue
      WHERE status = 'pending'
        AND scheduled_for <= NOW()
      ORDER BY
        CASE WHEN target = 'google_calendar' THEN 0 ELSE 1 END,
        scheduled_for ASC
      LIMIT 5
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `)) as unknown as Record<string, unknown>[];

  // Step 3: Process each claimed job — one transaction per job for isolated failure handling
  for (const job of jobs) {
    try {
      await executeJob(job);

      // Mark success
      await db.execute(sql`
        UPDATE calendar_sync_queue
        SET status = 'success', completed_at = NOW()
        WHERE id = ${job.id as number}
      `);
      processed++;
    } catch (err) {
      const currentAttempts = (job.attempts as number) ?? 0;
      const nextAttempts = currentAttempts + 1;
      const isPermanent = nextAttempts >= BACKOFF_MINUTES.length;
      const backoffMs = BACKOFF_MINUTES[Math.min(currentAttempts, BACKOFF_MINUTES.length - 1)] * 60_000;
      const nextScheduled = isPermanent ? null : new Date(Date.now() + backoffMs);

      console.error(`[CalendarSyncWorker] Job #${job.id} failed (attempt ${nextAttempts}):`, err);

      await db.execute(sql`
        UPDATE calendar_sync_queue
        SET
          status = ${isPermanent ? 'failed_permanent' : 'pending'},
          attempts = ${nextAttempts},
          last_error = ${String(err)},
          scheduled_for = ${nextScheduled},
          last_attempt_at = NOW()
        WHERE id = ${job.id as number}
      `);
      errors++;
    }
  }

  return { processed, errors, reaped };
}
