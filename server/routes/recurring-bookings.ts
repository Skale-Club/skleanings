/**
 * Recurring Bookings API
 * Phase 27 RECUR-02 / Phase 28 RECUR-03: cron endpoints (CRON_SECRET auth)
 * Phase 29 RECUR-04 / RECUR-05: admin + public self-serve endpoints
 */
import { Router } from "express";
import { runRecurringBookingGeneration } from "../services/recurring-booking-generator";
import { runRecurringBookingReminders } from "../services/recurring-booking-reminder";
import { requireAdmin } from "../lib/auth";
import {
  getBearerOrBodySecret,
  isMissingDatabaseRelation,
  sendCronSchemaNotReady,
} from "../lib/cron-utils";

// ── Cron router (existing, mounted at /api/recurring-bookings) ──────────────
const router = Router();

/**
 * POST /api/recurring-bookings/cron/generate
 * Triggered by GitHub Actions daily schedule (production) or manually for testing.
 * Auth: Bearer <CRON_SECRET>
 */
router.post("/cron/generate", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const provided = getBearerOrBodySecret(req);

  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const asOfDate = (req.body as { asOfDate?: string })?.asOfDate;
    const result = await runRecurringBookingGeneration(asOfDate);
    return res.json(result);
  } catch (err) {
    console.error("[RecurringRoute] Unhandled error in cron/generate:", err);
    if (isMissingDatabaseRelation(err)) {
      return sendCronSchemaNotReady(res, "recurring-booking-generation", err);
    }

    return res.status(500).json({
      message: "Internal server error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * POST /api/recurring-bookings/cron/send-reminders
 * Sends 48-hour reminder emails for upcoming recurring bookings.
 * Auth: Bearer <CRON_SECRET>
 */
router.post("/cron/send-reminders", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const provided = getBearerOrBodySecret(req);

  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const asOfDate = (req.body as { asOfDate?: string })?.asOfDate;
    const result = await runRecurringBookingReminders(asOfDate);
    return res.json(result);
  } catch (err) {
    console.error("[RecurringRoute] Unhandled error in cron/send-reminders:", err);
    if (isMissingDatabaseRelation(err)) {
      return sendCronSchemaNotReady(res, "recurring-booking-reminders", err);
    }

    return res.status(500).json({
      message: "Internal server error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;

// ── Admin router (Phase 29 RECUR-04, mounted at /api/admin/recurring-bookings) ─
export const adminRecurringRouter = Router();

/**
 * GET /api/admin/recurring-bookings
 * Returns all subscriptions with contact name and service name (for admin panel table).
 */
adminRecurringRouter.get("/", requireAdmin, async (req, res) => {
  const storage = res.locals.storage!;
  try {
    const subs = await storage.getRecurringBookingsWithDetails();
    return res.json(subs);
  } catch (err) {
    console.error("[AdminRecurring] getRecurringBookingsWithDetails error:", err);
    return res.status(500).json({ message: "Failed to load subscriptions" });
  }
});

/**
 * PATCH /api/admin/recurring-bookings/:id
 * Accepts { action: 'pause' | 'unpause' | 'cancel' }
 * Applies state machine transition and returns updated subscription.
 */
adminRecurringRouter.patch("/:id", requireAdmin, async (req, res) => {
  const storage = res.locals.storage!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid subscription id" });

  const { action } = req.body as { action: string };
  if (!["pause", "unpause", "cancel"].includes(action)) {
    return res.status(400).json({ message: "action must be one of: pause, unpause, cancel" });
  }

  try {
    const sub = await storage.getRecurringBooking(id);
    if (!sub) return res.status(404).json({ message: "Subscription not found" });
    if (sub.status === "cancelled") {
      return res.status(409).json({ message: "Subscription is already cancelled" });
    }
    if (action === "unpause" && sub.status !== "paused") {
      return res.status(409).json({ message: "Subscription is not paused" });
    }

    const newStatus = action === "pause" ? "paused" : action === "cancel" ? "cancelled" : "active";
    const updated = await storage.updateRecurringBooking(id, {
      status: newStatus,
      pausedAt: action === "pause" ? new Date() : action === "unpause" ? null : sub.pausedAt,
      cancelledAt: action === "cancel" ? new Date() : sub.cancelledAt,
      updatedAt: new Date(),
    });
    return res.json(updated);
  } catch (err) {
    console.error("[AdminRecurring] patch error:", err);
    return res.status(500).json({ message: "Failed to update subscription" });
  }
});

// ── Public router (Phase 29 RECUR-05, mounted at /api/subscriptions/manage) ──
export const publicRecurringRouter = Router();

/**
 * GET /api/subscriptions/manage/:token
 * Returns subscription status summary for the self-serve manage page.
 * No authentication — token IS the auth.
 */
publicRecurringRouter.get("/:token", async (req, res) => {
  const storage = res.locals.storage!;
  try {
    const sub = await storage.getRecurringBookingByToken(req.params.token);
    if (!sub) return res.status(404).json({ message: "Subscription not found" });

    const service = await storage.getService(sub.serviceId);
    return res.json({
      status: sub.status,
      frequencyName: sub.frequencyName,
      nextBookingDate: sub.nextBookingDate,
      serviceName: service?.name ?? "Cleaning Service",
    });
  } catch (err) {
    console.error("[PublicRecurring] GET manage error:", err);
    return res.status(500).json({ message: "Failed to load subscription" });
  }
});

/**
 * POST /api/subscriptions/manage/:token/action
 * Accepts { action: 'pause' | 'unpause' | 'cancel' }
 * Validates token, applies state machine, returns { status }.
 */
publicRecurringRouter.post("/:token/action", async (req, res) => {
  const storage = res.locals.storage!;
  const { action } = req.body as { action: string };
  if (!["pause", "unpause", "cancel"].includes(action)) {
    return res.status(400).json({ message: "action must be one of: pause, unpause, cancel" });
  }

  try {
    const sub = await storage.getRecurringBookingByToken(req.params.token);
    if (!sub) return res.status(404).json({ message: "Subscription not found" });
    if (sub.status === "cancelled") {
      return res.status(409).json({ message: "Subscription is already cancelled" });
    }
    if (action === "unpause" && sub.status !== "paused") {
      return res.status(409).json({ message: "Subscription is not paused" });
    }

    const newStatus = action === "pause" ? "paused" : action === "cancel" ? "cancelled" : "active";
    const updated = await storage.updateRecurringBooking(sub.id, {
      status: newStatus,
      pausedAt: action === "pause" ? new Date() : action === "unpause" ? null : sub.pausedAt,
      cancelledAt: action === "cancel" ? new Date() : sub.cancelledAt,
      updatedAt: new Date(),
    });
    return res.json({ status: updated.status });
  } catch (err) {
    console.error("[PublicRecurring] POST action error:", err);
    return res.status(500).json({ message: "Failed to update subscription" });
  }
});
