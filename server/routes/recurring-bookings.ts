/**
 * Recurring Bookings API — Phase 27 RECUR-02 / Phase 28 RECUR-03
 * Cron endpoints secured by CRON_SECRET Bearer token.
 */
import { Router } from "express";
import { runRecurringBookingGeneration } from "../services/recurring-booking-generator";
import { runRecurringBookingReminders } from "../services/recurring-booking-reminder";

const router = Router();

/**
 * POST /api/recurring-bookings/cron/generate
 * Triggered by GitHub Actions daily schedule (production) or manually for testing.
 * Auth: Bearer <CRON_SECRET>
 */
router.post("/cron/generate", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const provided =
    req.headers.authorization?.replace("Bearer ", "").trim() ??
    (req.body as { secret?: string })?.secret;

  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Optional: allow date override for testing (e.g. body: { asOfDate: "2026-06-01" })
    const asOfDate = (req.body as { asOfDate?: string })?.asOfDate;
    const result = await runRecurringBookingGeneration(asOfDate);
    return res.json(result);
  } catch (err) {
    console.error("[RecurringRoute] Unhandled error in cron/generate:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * POST /api/recurring-bookings/cron/send-reminders
 * Sends 48-hour reminder emails for upcoming recurring bookings.
 * Triggered by GitHub Actions daily schedule (production) or manually for testing.
 * Auth: Bearer <CRON_SECRET>
 */
router.post("/cron/send-reminders", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const provided =
    req.headers.authorization?.replace("Bearer ", "").trim() ??
    (req.body as { secret?: string })?.secret;

  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const asOfDate = (req.body as { asOfDate?: string })?.asOfDate;
    const result = await runRecurringBookingReminders(asOfDate);
    return res.json(result);
  } catch (err) {
    console.error("[RecurringRoute] Unhandled error in cron/send-reminders:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
