/**
 * Calendar Sync Routes — Phase 32
 * Mounted at /api/integrations/calendar-sync
 *
 * POST /cron/run       — GitHub Actions trigger (CRON_SECRET auth)
 * GET  /health         — Admin health panel data (requireAdmin)
 * POST /:jobId/retry   — Admin manual retry (requireAdmin)
 */
import { Router } from "express";
import { requireAdmin } from "../lib/auth";
import { storage } from "../storage";
import { runCalendarSyncWorker } from "../services/calendar-sync-worker";
import {
  getBearerOrBodySecret,
  isMissingDatabaseRelation,
  sendCronSchemaNotReady,
} from "../lib/cron-utils";

export const calendarSyncRouter = Router();

/**
 * POST /api/integrations/calendar-sync/cron/run
 * Auth: Bearer <CRON_SECRET> (GitHub Actions)
 */
calendarSyncRouter.post("/cron/run", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const provided = getBearerOrBodySecret(req);

  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const result = await runCalendarSyncWorker();
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[CalendarSyncRoute] Worker error:", err);
    if (isMissingDatabaseRelation(err)) {
      return sendCronSchemaNotReady(res, "calendar-sync", err);
    }

    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * GET /api/integrations/calendar-sync/health
 * Returns pending/failed counts per target + recent failure list.
 * Auth: admin session
 */
calendarSyncRouter.get("/health", requireAdmin, async (_req, res) => {
  try {
    const health = await storage.getCalendarSyncHealth();
    return res.json({ targets: health });
  } catch (err) {
    console.error("[CalendarSyncRoute] Health error:", err);
    return res.status(500).json({ error: "Failed to fetch sync health" });
  }
});

/**
 * POST /api/integrations/calendar-sync/:jobId/retry
 * Resets a failed_permanent or failed_retryable job back to pending.
 * Auth: admin session
 */
calendarSyncRouter.post("/:jobId/retry", requireAdmin, async (req, res) => {
  const jobId = Number(req.params.jobId);
  if (!jobId || isNaN(jobId)) {
    return res.status(400).json({ message: "Invalid job ID" });
  }
  try {
    await storage.retryCalendarSyncJob(jobId);
    return res.json({ success: true, jobId });
  } catch (err) {
    console.error("[CalendarSyncRoute] Retry error:", err);
    return res.status(500).json({ error: "Failed to retry job" });
  }
});
